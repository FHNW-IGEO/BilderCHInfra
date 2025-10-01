// Declare variables for the data, SVG, simulation, nodes, and links
const SWISSMAP = '/data/switzerland.geojson';
const DATA_URL = '/data/data2.json';
let sampleData = {};
let data, svg, simulation;
let nodes, links, link, node;
let y, x;
let isAnimating = false;
let topicColorMap;
// Fetch data from the 'kraftwerke.json' file and trigger drawing of the network on success
fetch(DATA_URL)
  .then(response => response.json())
  .then(json => {
    sampleData = json; // Save the fetched data
    data = JSON.parse(JSON.stringify(sampleData)); // Create a deep copy of the data
    drawNetwork(); // Call the function to draw the network visualization
  })
  .catch(error => console.error('Error loading JSON:', error)); // Handle errors in fetching data
// Define graph visualization dimensions and margins
const width = 1600;
const height = 1000;
const margin = { left: 100, right: 50, top: 50, bottom: 50 };
const color = d3.scaleOrdinal(d3.schemeCategory10); // Define color scale for nodes
// Initialize graph structure: Set default properties for nodes and links
function initGraph(data) {
  // Set up each node's initial properties (e.g., row, degree, and neighbors)
  for (let node of data.nodes) {
    node.row = -1;
    node.degree = 0;
    node.neighbors = [];
    node.minCol = Number.MAX_SAFE_INTEGER;
    node.maxCol = Number.MIN_SAFE_INTEGER;
  }
  // Create a map of node IDs to their indices in the data array
  const nodeMap = Object.fromEntries(data.nodes.map((d, i) => [d.id, i]));
  // Link nodes together by updating their degree and neighbors based on the links data
  for (let link of data.links) {
    const source = data.nodes[nodeMap[link.source]];
    const target = data.nodes[nodeMap[link.target]];
    source.degree++;
    target.degree++;
    source.neighbors.push(target);
    target.neighbors.push(source);
  }
}
// Function to compare nodes based on their degree (descending order)
function compareNodeDegree(a, b) {
  return b.degree - a.degree;
}
// Function to order nodes by degree (most connected first)
function orderNodes(data) {
  data.nodes.sort(compareNodeDegree); // Sort nodes based on degree
  // Sort neighbors of each node by degree
  for (let node of data.nodes) {
    node.neighbors.sort(compareNodeDegree);
  }
}
// Assign rows to nodes and neighbors to create layers of nodes in the visualization
function assignRows(data) {
  let nextRow = 0;
  for (let node of data.nodes) {
    if (node.row !== -1) continue; // Skip nodes already assigned to a row
    node.row = nextRow++;
    // Assign rows to neighbors if they don't have one already
    for (let neighbor of node.neighbors) {
      if (neighbor.row === -1) {
        neighbor.row = nextRow++;
      }
    }
  }
}
// Function to order links based on row and height
function orderLinks(data) {
  const nodeMap = Object.fromEntries(data.nodes.map((d, i) => [d.id, i]));
  // Iterate over all links to set row and height properties
  for (let i = 0; i < data.links.length; i++) {
    const link = data.links[i];
    const source = data.nodes[nodeMap[link.source]];
    const target = data.nodes[nodeMap[link.target]];
    link.row = Math.min(source.row, target.row);
    link.height = Math.abs(source.row - target.row);
    link.index = i;
  }
  // Sort links by row and height
  data.links.sort((a, b) => a.row !== b.row ? a.row - b.row : a.height - b.height);
  // Assign indices to sorted links
  for (let i = 0; i < data.links.length; i++) {
    data.links[i].index = i;
  }
}
// Compute ranges for each node's minimum and maximum column (used for layout)
function computeRanges(data) {
  const nodeMap = Object.fromEntries(data.nodes.map((d, i) => [d.id, i]));
  for (let i = 0; i < data.links.length; i++) {
    const link = data.links[i];
    const source = data.nodes[nodeMap[link.source]];
    const target = data.nodes[nodeMap[link.target]];
    source.minCol = Math.min(source.minCol, i);
    source.maxCol = Math.max(source.maxCol, i);
    target.minCol = Math.min(target.minCol, i);
    target.maxCol = Math.max(target.maxCol, i);
  }
}
// Parse coordinates (e.g., latitude, longitude) from string format
function parseCoords(coordStr) {
  if (typeof coordStr === "string" && coordStr.includes(",")) {
    const coords = coordStr.split(",").map(s => parseFloat(s.trim()));
    if (coords.length === 2 && !coords.some(isNaN)) {
      // Return coordinates as [longitude, latitude] for projection
      return [coords[1], coords[0]];
    }
  }
  return null; // Return null if coordinates are not valid
}
// Load Switzerland map as a background layer for the network visualization
function loadSwitzerlandMap(svg, projection) {
  d3.json(SWISSMAP).then(function(switzerland) {
    const mapLayer = svg.append("g").attr("class", "map-layer").lower();
    const geoPathGenerator = d3.geoPath().projection(projection);
    // Add map paths (features) from Switzerland GeoJSON
    mapLayer.selectAll("path")
      .data(switzerland.features)
      .enter()
      .append("path")
      .attr("d", geoPathGenerator)
      .attr("fill", "#e0e0e0")
      .style("opacity", 1);
  });
}
// Main function to draw the network visualization
function drawNetwork() {
  data = JSON.parse(JSON.stringify(sampleData)); // Make a deep copy of the data
  initGraph(data); // Initialize graph structure
  orderNodes(data); // Order nodes by degree
  assignRows(data); // Assign rows to nodes
  orderLinks(data); // Order links by row and height
  computeRanges(data); // Compute ranges for node layout
  // Get the chart container's size and define scales for layout
  const chart = document.getElementById('chart');
  const rect = chart.getBoundingClientRect();
  const width = rect.width;
  const height = rect.height;
  // Define color scale for topics
  typeColor = d3.scaleOrdinal()
    .domain([...new Set(data.links.map(d => d.type))])
    .range(d3.schemeTableau10);
  // Set up y and x scales for the graph layout
  y = d3.scaleBand()
    .domain(d3.range(data.nodes.length))
    .range([margin.top, height - margin.bottom])
    .padding(0.1);
  x = d3.scaleBand()
    .domain(d3.range(data.links.length))
    .range([margin.left, width - margin.right])
    .padding(0.1);
  // Create deep copies of nodes and links for later processing
  links = data.links.map(d => Object.create(d));
  nodes = data.nodes.map(d => Object.create(d));
  // Remove any previous SVG elements from the chart container
  d3.select("#chart").selectAll("*").remove();
  // Set up the SVG container for drawing
  svg = d3.select("#chart").append("svg")
    .attr("viewBox", `0 0 ${width} ${height}`)
    .attr("preserveAspectRatio", "xMidYMid meet");
  // Set up map projection (Mercator) and load Switzerland map
  const projection = d3.geoMercator()
    .center([8.3, 46.8]) // Center of Switzerland
    .scale(6000)
    .translate([width / 2, height / 2]);
  loadSwitzerlandMap(svg, projection);
  // Set up color mapping for topics in the network
  topicColorMap = d3.scaleOrdinal()
    .domain([...new Set(data.nodes.map(d => d.group))])
    .range(d3.schemeTableau10);
  // Map nodes that belong to a group 'thema' to a different color
  const themaColorMap = new Map();
  data.nodes.forEach(d => {
    if (d.group !== "thema") {
      themaColorMap.set(d.name, topicColorMap(d.group));
    }
  });
  
// ===== GROUP FOR THEMA NODES =====
const themaGroup = svg.append('g')
  .attr('class', 'thema-nodes');

// Position nodes and create thema-node labels
let j = 0;
nodes.forEach(d => {
  const coords = parseCoords(d.koordinaten);
  if (!coords && d.group === "thema") {
    j++;
    const offset = 20;
    const x = 100;
    const y = 50 + j * offset;
    d.x = x;
    d.y = y;

    // Append label inside the themaGroup (Legend)
    themaGroup.append("text")
      .attr("class", "thema-node")
      .attr("x", x + 15)
      .attr("y", y + 5)
      .text(d.id)
      .style("opacity", 1)
      .attr("font-size", 12)
      .attr("fill", "#333")
      .attr("font-family", "sans-serif");
  } else if (coords) {
    const [xProj, yProj] = projection(coords);
    d.x = xProj;
    d.y = yProj;
  } else {
    d.x = -10;
    d.y = -10;
  }
});

// Map nodes by ID for links
const nodeById = new Map(nodes.map(d => [d.id, d]));
links.forEach(l => {
  l.source = nodeById.get(l.source);
  l.target = nodeById.get(l.target);
});

// Draw nodes on map / network overlay
const nodeSelection = svg.append("g")
  .attr("class", "node")
  .attr("stroke", "#fff")
  .attr("stroke-width", 1.5)
  .selectAll("circle")
  .data(nodes)
  .join("circle")
  .attr("r", 5)
  .attr("fill", d => {
    if (d.group === "thema") {
      const correspondingNode = nodes.find(node => node.group === d.name && node.group !== "thema");
      if (correspondingNode) return topicColorMap(correspondingNode.group);
    } else return topicColorMap(d.group);
  })
  .attr("cx", d => d.x)
  .attr("cy", d => d.y);

// ===== HIGHLIGHT FUNCTION =====
function highlightThema(themaName) {
  console.log(themaName)
  // Highlight network + map nodes
nodeSelection
  .transition().duration(200)
  .attr('opacity', d => {
    console.log(d.group !== 'thema'); // log the node
    return (d.group === themaName || (d.group === 'thema' && d.name === themaName)) ? 0.9 : 0.05;
  });

  // Highlight outer overlay nodes
  d3.selectAll('.outer-dots circle')
    .transition().duration(200)
    .attr('opacity', d => d.group === themaName ? 0.9 : 0.05)

  // Highlight overlay labels
  d3.selectAll('.outer-dots .label text')
    .transition().duration(200)
    .attr('opacity', d => d.group === themaName ? 0.9 : 0.05);


  // Highlight overlay labels
d3.selectAll('.arc-end')
  .transition().duration(200)
  .attr('opacity', d => (d.source.group === themaName || d.target.group === themaName) ? 0.9 : 0.05);

    // Highlight overlay labels
d3.selectAll('.arc-group')
  .transition().duration(200)
  .attr('opacity', d => (d.source.group === themaName || d.target.group === themaName) ? 0.9 : 0.05);

    // Highlight connectors
  d3.selectAll('.ring-links line')
    .transition().duration(200)
    .attr('stroke-opacity', d => d.group === themaName ? 0.9 : 0.05);

  
  // Highlight connectors
  d3.selectAll('.nocoordconnector')
    .transition().duration(200)
    .attr('stroke-opacity', d => d.group === themaName ? 0.9 : 0.05);
  
}

// ===== CLICK HANDLER FOR LEGEND =====
themaGroup.selectAll('.thema-node')
  .on('click', function(event, d) {
    const themaName = d3.select(this).text();
    highlightThema(themaName);
  });
 
}