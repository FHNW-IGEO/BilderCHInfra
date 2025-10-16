import {
    parseCoords,
    highlightThema,
    initGraph,
    loadSwitzerlandMap
} from './functions.js';

let data, svg, topicColorMap
let nodes, links;

// Main function to draw the network visualization
export function drawNetwork(data, swissmap, map_center, map_scale, radius_ratio) {
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
        .attr("viewBox", `0 0 ${width} ${height}`) // Define the viewBox to fit the content
        .attr("preserveAspectRatio", "xMidYMid meet"); // Maintain aspect ratio and center the content
    // Ensure main svg sits above overlay by default
    // Set up map projection (Mercator) and load Switzerland map
    const projection = d3.geoMercator()
        .center(map_center)
        .scale(map_scale)
        .translate([width / 2, height / 2]);

    loadSwitzerlandMap(svg, projection, swissmap);

    const cx = width/2
        const cy = height/2
       const baseRadius = Math.min(cx, cy) * radius_ratio;
        // Add a white donut shape under the network
        const donutGroup = svg.append('g').attr('class', 'donut-background');

        // Define the donut arc generator
        const donutArc = d3.arc()
            .innerRadius(baseRadius) // Inner radius (cutout in the middle)
            .outerRadius(baseRadius * 40) // Outer radius
            .startAngle(0) // Start angle (0 radians)
            .endAngle(2 * Math.PI); // End angle (full circle)
            
        // Append the donut path
        donutGroup.append('path')
            .attr('d', donutArc())
            .attr('fill', 'white') // White background
            .attr('transform', `translate(${cx}, ${cy})`)


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
        .attr("stroke-width", 1)
        .selectAll("circle")
        .data(nodes)
        .join("circle")
        .attr("r", radius_ratio * 6)
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
        .on('click', function(event, d) {

            const themaName = d3.select(this).text();
            highlightThema(themaName, nodeSelection);
        });
    themaGroup.raise();          

    window.addEventListener('resize', () => {
        const container = document.getElementById('chart');
        if (container){
            drawNetwork(data, swissmap, map_center, map_scale, radius_ratio)

                    }
            else{
            return null
        }
    });
}