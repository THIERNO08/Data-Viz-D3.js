const dataPath1 = "https://cdn.freecodecamp.org/testable-projects-fcc/data/choropleth_map/counties.json";
const dataPath2 = "https://cdn.freecodecamp.org/testable-projects-fcc/data/choropleth_map/for_user_education.json";

let globalCountyData;

async function loadData() {
    const [topologyData, educationData] = await Promise.all([
        d3.json(dataPath1),
        d3.json(dataPath2)
    ]);

    const geo = topojson.feature(topologyData, topologyData.objects.counties);

    return { topologyData, educationData, geo };
}

loadData().then(({ topologyData, educationData, geo }) => {
    globalCountyData = geo;

    console.log("Données prêtes :", { educationData, geo });

    initFilters(educationData);
    
    if (typeof createBarChart === "function") createBarChart(educationData, "#edu-histogram");
    
    const mapChart = Choropleth(educationData, {
        id: d => d.fips,
        value: d => d.bachelorsOrHigher,
        features: geo,
        featureId: d => d.id,
        borders: topojson.mesh(topologyData, topologyData.objects.counties, (a, b) => a !== b),
        width: 960,
        height: 600
    });

    if (mapChart) {
        d3.select("#choro").node().appendChild(mapChart);
    }

    if (typeof createPieChart === "function") createPieChart(educationData, "#edu-piechart");
    
    if (typeof updateStats === "function") updateStats(educationData, "all");

    const overlay = document.getElementById('loading-overlay');
    if (overlay) overlay.style.display = 'none';
    
}).catch(error => {
    console.error("Erreur de chargement:", error);
    const overlay = document.getElementById('loading-overlay');
    if (overlay) overlay.style.display = 'none';
});

function initFilters(data) {
  const states = Array.from(new Set(data.map(d => d.state))).sort();
  const select = d3.select("#area_name");

  select.selectAll("option").remove();
  select.append("option").attr("value", "all").text("Tous les états");
  
  states.forEach(state => {
    select.append("option").attr("value", state).text(state);
  });

  select.on("change", () => {
    const selectedState = select.property("value");
    updateCharts(data, selectedState);
  });
}

function Choropleth(data, {
  id = d => d.id,
  value = d => d.value,
  features,
  featureId = d => d.id,
  borders,
  width = 960,
  height = 600,
  colors = d3.schemeBlues[9]
} = {}) {
  const featureArray = features.features ? features.features : features;
  const dataMap = new Map(data.map(d => [id(d), d]));
  const V = data.map(d => value(d));
  const domain = d3.extent(V);

  const projection = d3.geoIdentity().fitSize([width, height], {type: "FeatureCollection", features: featureArray});
  const path = d3.geoPath(projection);
  const colorScale = d3.scaleQuantize(domain, colors);
  
  const svg = d3.create("svg")
    .attr("viewBox", [0, 0, width, height])
    .attr("preserveAspectRatio", "xMidYMid meet")
    .style("width", "100%")
    .style("height", "100%")
    .style("display", "block");
  
  svg.append("g")
    .selectAll("path")
    .data(featureArray)
    .join("path")
    .attr("fill", d => {
      const entry = dataMap.get(featureId(d));
      return entry ? colorScale(value(entry)) : "#2a2d47";
    })
    .attr("stroke", "#1a1f3a")
    .attr("stroke-width", 0.5)
    .attr("d", path)
    .on("mouseover", function(event, d) {
      const entry = dataMap.get(featureId(d));
      if (entry) {
        d3.select(this)
          .attr("stroke", "#00d4ff")
          .attr("stroke-width", 2);
        
        const tooltip = d3.select("body").append("div")
          .attr("class", "tooltip-map")
          .style("visibility", "visible")
          .style("left", (event.pageX + 10) + "px")
          .style("top", (event.pageY - 10) + "px")
          .text(`${entry.area_name}, ${entry.state}: ${value(entry).toFixed(1)}%`);
      }
    })
    .on("mouseout", function() {
      d3.select(this)
        .attr("stroke", "#1a1f3a")
        .attr("stroke-width", 0.5);
      
      d3.selectAll(".tooltip-map").remove();
    })
    .append("title")
    .text(d => {
      const entry = dataMap.get(featureId(d));
      return entry ? `${entry.area_name}, ${entry.state}: ${value(entry).toFixed(1)}%` : "N/A";
    });

  if (borders) {
    svg.append("path")
      .attr("fill", "none")
      .attr("stroke", "#4a5568")
      .attr("stroke-width", 1)
      .attr("d", path(borders));
  }

  const legendWidth = 250;
  const legendHeight = 15;
  const thresholds = colorScale.thresholds();
  
  const legendScale = d3.scaleLinear()
    .domain(domain)
    .range([0, legendWidth]);

  const legend = svg.append("g")
    .attr("id", "legend")
    .attr("transform", `translate(${width - legendWidth - 40}, 30)`);

  legend.selectAll("rect")
    .data(colors)
    .enter()
    .append("rect")
    .attr("x", (d, i) => i * (legendWidth / colors.length))
    .attr("width", legendWidth / colors.length)
    .attr("height", legendHeight)
    .attr("fill", d => d)
    .attr("stroke", "#1a1f3a")
    .attr("stroke-width", 0.5);

  legend.append("g")
    .attr("transform", `translate(0, ${legendHeight})`)
    .call(d3.axisBottom(legendScale)
      .tickValues(thresholds)
      .tickFormat(d => Math.round(d) + "%")
      .tickSize(6)
    )
    .selectAll("text")
    .style("font-size", "10px")
    .style("fill", "#a3b1cc");

  legend.append("text")
    .attr("x", legendWidth / 2)
    .attr("y", -6)
    .attr("text-anchor", "middle")
    .style("font-size", "12px")
    .style("font-weight", "bold")
    .style("fill", "#ffffff")
    .text("Pourcentage de diplômés (%)");

  return svg.node();
}

function createBarChart(educationData, selector) {
  const bins = [
    { range: "0-10%", min: 0, max: 10 },
    { range: "10-20%", min: 10, max: 20 },
    { range: "20-30%", min: 20, max: 30 },
    { range: "30-40%", min: 30, max: 40 },
    { range: "40-50%", min: 40, max: 50 },
    { range: "50-60%", min: 50, max: 60 },
    { range: "60-70%", min: 60, max: 70 },
    { range: "70-80%", min: 70, max: 80 },
  ];

  bins.forEach((bin) => {
    bin.count = educationData.filter(
      (d) => d.bachelorsOrHigher >= bin.min && d.bachelorsOrHigher < bin.max,
    ).length;
  });

  const margin = { top: 20, right: 20, bottom: 50, left: 50 };
  const width = 400 - margin.left - margin.right;
  const height = 300 - margin.top - margin.bottom;

  const svg = d3
    .select(selector)
    .append("svg")
    .attr("width", width + margin.left + margin.right)
    .attr("height", height + margin.top + margin.bottom)
    .append("g")
    .attr("transform", `translate(${margin.left}, ${margin.top})`);

  const xScale = d3
    .scaleBand()
    .domain(bins.map((d) => d.range))
    .range([0, width])
    .padding(0.1);

  const yScale = d3
    .scaleLinear()
    .domain([0, d3.max(bins, (d) => d.count)])
    .range([height, 0]);

  const colors = d3.schemeCategory10;

  svg
    .selectAll("rect")
    .data(bins)
    .enter()
    .append("rect")
    .attr("x", (d) => xScale(d.range))
    .attr("y", (d) => yScale(d.count))
    .attr("width", xScale.bandwidth())
    .attr("height", (d) => height - yScale(d.count))
    .attr("fill", (d, i) => colors[i % colors.length])
    .on("mouseover", function(event, d) {
      const i = bins.indexOf(d);
      d3.select(this)
        .attr("fill", "#888")
        .style("opacity", 0.8);

      svg.append("text")
        .attr("class", "tooltip-text")
        .attr("x", xScale(d.range) + xScale.bandwidth() / 2)
        .attr("y", yScale(d.count) - 5)
        .attr("text-anchor", "middle")
        .style("font-size", "12px")
        .style("font-weight", "bold")
        .style("fill", "#b8d0db")
        .text(d.count + " comtés");
    })
    .on("mouseout", function(event, d) {
      const i = bins.indexOf(d);
      d3.select(this)
        .attr("fill", colors[i % colors.length])
        .style("opacity", 1);
      
      svg.selectAll(".tooltip-text").remove();
    });

  svg
    .append("g")
    .attr("transform", `translate(0, ${height})`)
    .call(d3.axisBottom(xScale))
    .selectAll("text")
    .style("text-anchor", "middle")
    .style("font-size", "10px");

  svg
    .append("text")
    .attr("x", width / 2)
    .attr("y", height + 40)
    .attr("text-anchor", "middle")
    .style("font-size", "16px")
    .text("Pourcentage de diplômés (tranches)");

  svg
    .append("g")
    .call(d3.axisLeft(yScale));

  svg
    .append("text")
    .attr("transform", "rotate(-90)")
    .attr("x", -height / 2)
    .attr("y", -35)
    .attr("text-anchor", "middle")
    .style("font-size", "16px")
    .text("Nombre de comtés");
}

// Fonction pour créer le diagramme circulaire
function createPieChart(data, selector) {
  const categories = [
    { name: "Très faible (0-15%)", min: 0, max: 15, color: "#d32f2f" },
    { name: "Faible (15-25%)", min: 15, max: 25, color: "#f57c00" },
    { name: "Moyen (25-35%)", min: 25, max: 35, color: "#fbc02d" },
    { name: "Élevé (35-50%)", min: 35, max: 50, color: "#388e3c" },
    { name: "Très élevé (50%+)", min: 50, max: 100, color: "#1976d2" }
  ];
  
  categories.forEach(cat => {
    cat.value = data.filter(d => 
      d.bachelorsOrHigher >= cat.min && 
      d.bachelorsOrHigher < cat.max
    ).length;
  });
  
  const filteredCategories = categories.filter(cat => cat.value > 0);
  
  const width = 400;
  const height = 300;
  const radius = Math.min(width, height) / 2 - 40;
  
  const svg = d3
    .select(selector)
    .append("svg")
    .attr("width", width)
    .attr("height", height);
  
  const pieGroup = svg
    .append("g")
    .attr("transform", `translate(${width / 3}, ${height / 2})`);
  
  const color = d3.scaleOrdinal()
    .domain(filteredCategories.map(d => d.name))
    .range(filteredCategories.map(d => d.color));

  const pie = d3.pie()
    .value((d) => d.value)
    .sort(null);

  const arc = d3.arc()
    .innerRadius(0)
    .outerRadius(radius);

  const arcHover = d3.arc()
    .innerRadius(0)
    .outerRadius(radius + 8);

  const paths = pieGroup
    .selectAll("path")
    .data(pie(filteredCategories))
    .enter()
    .append("path")
    .attr("d", arc)
    .attr("fill", (d) => color(d.data.name))
    .style("cursor", "pointer")
    .style("opacity", 0);
  
  paths.transition().duration(800).style("opacity", 1);
  
  paths
    .on("mouseover", function(event, d) {
      d3.select(this)
        .transition()
        .duration(200)
        .attr("d", arcHover);
      
      const percentage = ((d.data.value / data.length) * 100).toFixed(1);
      
      pieGroup.append("text")
        .attr("class", "tooltip-pie")
        .attr("text-anchor", "middle")
        .attr("y", -10)
        .style("font-size", "14px")
        .style("font-weight", "bold")
        .style("fill", "#e8f1ff")
        .style("stroke", "rgba(0,0,0,0.4)")
        .style("stroke-width", 2)
        .text(d.data.name);
      
      pieGroup.append("text")
        .attr("class", "tooltip-pie")
        .attr("text-anchor", "middle")
        .attr("y", 10)
        .style("font-size", "12px")
        .style("fill", "#fff")
        .style("stroke", "#000")
        .style("stroke-width", 0.5)
        .text(`${d.data.value} comtés (${percentage}%)`);
    })
    .on("mouseout", function() {
      d3.select(this)
        .transition()
        .duration(200)
        .attr("d", arc);
      
      pieGroup.selectAll(".tooltip-pie").remove();
    });
  
  const legend = svg
    .selectAll(".legend")
    .data(filteredCategories)
    .enter()
    .append("g")
    .attr("class", "legend")
    .attr("transform", (d, i) => `translate(${width * 2/3 + 20}, ${50 + i * 20})`);
  
  legend
    .append("rect")
    .attr("width", 12)
    .attr("height", 12)
    .attr("fill", d => color(d.name));
  
  legend
    .append("text")
    .attr("x", 18)
    .attr("y", 6)
    .attr("dy", "0.35em")
    .style("font-size", "11px")
    .style("fill", "#87ccdf")
    .text(d => `${d.name}: ${d.value}`);
}

function updateCharts(educationData, state) {
  const filteredData = state === "all" ? educationData : educationData.filter(d => d.state === state);

  d3.select("#edu-histogram").selectAll("*").remove();
  createBarChart(filteredData, "#edu-histogram");

  d3.select("#choropleth-map").selectAll("*").remove();
  
  const mapChart = Choropleth(filteredData, {
    id: d => d.fips,
    value: d => d.bachelorsOrHigher,
    features: globalCountyData,
    featureId: d => d.id,
    width: 960,
    height: 600
  });
  
  d3.select("#choropleth-map").node().appendChild(mapChart);

  d3.select("#edu-piechart").selectAll("*").remove();
  createPieChart(filteredData, "#edu-piechart");
  
  updateStats(filteredData, state);
}

function updateStats(data, state) {
  const countyCount = data.length;
  const stateCount = state === "all" ? 
    new Set(data.map(d => d.state)).size : 1;
  
  d3.select("#county-count").text(countyCount);
  d3.select("#state-count").text(stateCount);
  d3.select("#last-update").text(new Date().toLocaleTimeString('fr-FR'));
}

document.getElementById('refresh-btn').addEventListener('click', function() {
  location.reload();
});
