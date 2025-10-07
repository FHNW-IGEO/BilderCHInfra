import {
	parseCoords,
	highlightThema,
	initGraph,
	loadSwitzerlandMap
} from './functions.js';

// Declare variables for the data, SVG, simulation, nodes, and links
const SWISSMAP = '/BilderCHInfra/visualisation_examples/data/switzerland.geojson';
const DATA_URL = '/BilderCHInfra/visualisation_examples/data/Nationalstrassen_Hochspannung.json';
const MAP_SCALE = 4000;
let sampleData = {};
let data, svg, topicColorMap
let nodes, links;

// Fetch data from the 'kraftwerke.json' file and trigger drawing of the network on success
fetch(DATA_URL)
	.then(response => response.json())
	.then(json => {
		sampleData = json; // Save the fetched data
		data = JSON.parse(JSON.stringify(sampleData)); // Create a deep copy of the data
		drawNetwork(); // Call the function to draw the network visualization
	})
	.catch(error => console.error('Error loading JSON:', error)); // Handle errors in fetching data

// Main function to draw the network visualization
function drawNetwork() {
	data = JSON.parse(JSON.stringify(sampleData)); // Make a deep copy of the data
	initGraph(data); // Initialize graph structure

	// Get the chart container's size and define scales for layout
	const chart = document.getElementById('chart');
	const rect = chart.getBoundingClientRect();
	const width = rect.width;
	const height = rect.height;

	// Remove any previous SVG elements from the chart container
	d3.select("#chart").selectAll("*").remove();
	// Set up the SVG container for drawing
	svg = d3.select("#chart").append("svg")
		.attr("viewBox", `0 0 ${width} ${height}`)
		.attr("preserveAspectRatio", "xMidYMid meet");
	// Set up map projection (Mercator) and load Switzerland map
	const projection = d3.geoMercator()
		.center([8.3, 46.8]) // Center of Switzerland
		.scale(MAP_SCALE * (width / 1000))
		.translate([width / 2, height / 2]);
	loadSwitzerlandMap(svg, projection, SWISSMAP);

	// Create deep copies of nodes and links for later processing
	links = data.links.map(d => Object.create(d));
	nodes = data.nodes.map(d => Object.create(d));
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
		.attr("r", 4)
		.attr("fill", d => {
			if (d.group === "thema") {
				const correspondingNode = nodes.find(node => node.group === d.name && node.group !== "thema");
				if (correspondingNode) return topicColorMap(correspondingNode.group);
			} else return topicColorMap(d.group);
		})
		.attr("cx", d => d.x)
		.attr("cy", d => d.y);

	// ===== CLICK HANDLER FOR LEGEND =====
	themaGroup.selectAll('.thema-node')
		.on('click', function (event, d) {
			const themaName = d3.select(this).text();
			highlightThema(themaName, nodeSelection);
		});

	window.addEventListener('resize', () => {
		drawNetwork();
	});
}