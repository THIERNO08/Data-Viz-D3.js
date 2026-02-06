const dataPath = "data/data.json";
async function loadData() {
  const data = await d3.json(dataPath);
  return data;
}
loadData().then((data) => {
  // Initialiser les filtres
  initFilters(data);
  // Créer les graphiques
  createBarChart(data, "#chart1");
  createLineChart(data, "#chart2");
  createPieChart(data, "#chart3");
});
function initFilters(data) {
  const categories = Array.from(new Set(data.map((d) => d.category)));
  const select = d3.select("#category");
  categories.forEach((cat) => {
    select.append("option").attr("value", cat).text(cat);
  });
  select.on("change", () => {
    const selectedCategory = select.property("value");
    updateCharts(data, selectedCategory);
  });
}
function createBarChart(data, selector) {
  const svg = d3
    .select(selector)
    .append("svg")
    .attr("width", 400)
    .attr("height", 300);
  const xScale = d3
    .scaleBand()
    .domain(data.map((d) => d.name))
    .range([0, 400])
    .padding(0.1);
  const yScale = d3
    .scaleLinear()
    .domain([0, d3.max(data, (d) => d.value)])
    .range([300, 0]);
  svg
    .selectAll("rect")
    .data(data)
    .enter()
    .append("rect")
    .attr("x", (d) => xScale(d.name))
    .attr("y", (d) => yScale(d.value))
    .attr("width", xScale.bandwidth())
    .attr("height", (d) => 300 - yScale(d.value))
    .attr("fill", "#4CAF50");

  // Axes

  svg
    .append("g")
    .attr("transform", "translate(0, 300)")
    .call(d3.axisBottom(xScale));

  svg
    .append("g")
    .call(d3.axisLeft(yScale));
}
function createLineChart(data, selector) {
  const svgWidth = 400;
  const svgHeight = 300;
  const margin = { top: 20, right: 20, bottom: 30, left: 50 };
  const width = svgWidth - margin.left - margin.right;
  const height = svgHeight - margin.top - margin.bottom;
  const svg = d3
    .select(selector)
    .append("svg")
    .attr("width", svgWidth)
    .attr("height", svgHeight)
    .append("g")
    .attr("transform", `translate(${margin.left}, ${margin.top})`);

  const xScale = d3
    .scaleTime()
    .domain(d3.extent(data, (d) => new Date(d.date)))
    .range([0, width]);
  const yScale = d3
    .scaleLinear()
    .domain([0, d3.max(data, (d) => d.value)])
    .range([height, 0]);
  const line = d3
    .line()
    .x((d) => xScale(new Date(d.date)))
    .y((d) => yScale(d.value));
  svg
    .append("path")
    .datum(data)
    .attr("fill", "none")
    .attr("stroke", "#4CAF50")
    .attr("stroke-width", 2)
    .attr("d", line);
  // Axes
  svg
    .append("g")
    .attr("transform", `translate(0, ${height})`)
    .call(d3.axisBottom(xScale).ticks(5));
  svg.append("g").call(d3.axisLeft(yScale));
}
function createPieChart(data, selector) {
  const width = 300;
  const height = 300;
  const radius = Math.min(width, height) / 2;
  const svg = d3
    .select(selector)
    .append("svg")
    .attr("width", width)
    .attr("height", height)
    .append("g")
    .attr("transform", `translate(${width / 2}, ${height / 2})`);

  const color = d3.scaleOrdinal(d3.schemeCategory10);

  const pie = d3
        .pie()
        .value((d) => d.value);

  const arc = d3
        .arc()
        .innerRadius(0)
        .outerRadius(radius);
        
  svg
    .selectAll("path")
    .data(pie(data))
    .enter()
    .append("path")
    .attr("d", arc)
    .attr("fill", (d) => color(d.data.name));
}
function updateCharts(data, category) {
  const filteredData =
    category === "all" ? data : data.filter((d) => d.category === category);
  // Mettre à jour le diagramme à barres
  d3.select("#chart1 svg").remove();
  createBarChart(filteredData, "#chart1");
  // Mettre à jour le diagramme à lignes
  d3.select("#chart2 svg").remove();
  createLineChart(filteredData, "#chart2");
  // Mettre à jour le diagramme circulaire
  d3.select("#chart3 svg").remove();
  createPieChart(filteredData, "#chart3");
}
