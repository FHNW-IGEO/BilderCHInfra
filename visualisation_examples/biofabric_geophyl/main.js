    const DATA_URL = '/BilderCHInfra/visualisation_examples/data/kraftwerke.json';
    const SWISSMAP = '/BilderCHInfra/visualisation_examples/data/switzerland.geojson';
    let sampleData = {};
    let data, svg, simulation;
    let nodes, links, link, node;
    let y, x;
    let isAnimating = false;

    fetch(DATA_URL)
        .then(response => response.json())
        .then(json => {
            sampleData = json;
            data = JSON.parse(JSON.stringify(sampleData));
            drawNetwork(); 
        })
        .catch(error => console.error('Error loading JSON:', error));


    const width = 1600;
    const height = 1000;
    const margin = {
        left: 100,
        right: 50,
        top: 50,
        bottom: 50
    };

    const color = d3.scaleOrdinal(d3.schemeCategory10);

    function initGraph(data) {
        for (let node of data.nodes) {
            node.row = -1;
            node.degree = 0;
            node.neighbors = [];
            node.minCol = Number.MAX_SAFE_INTEGER;
            node.maxCol = Number.MIN_SAFE_INTEGER;
        }

        const nodeMap = Object.fromEntries(data.nodes.map((d, i) => [d.id, i]));

        for (let link of data.links) {
            const source = data.nodes[nodeMap[link.source]];
            const target = data.nodes[nodeMap[link.target]];
            source.degree++;
            target.degree++;
            source.neighbors.push(target);
            target.neighbors.push(source);
        }
    }

    function compareNodeDegree(a, b) {
        return b.degree - a.degree;
    }

    function orderNodes(data) {
        data.nodes.sort(compareNodeDegree);
        for (let node of data.nodes) {
            node.neighbors.sort(compareNodeDegree);
        }
    }

    function assignRows(data) {
        let nextRow = 0;
        for (let node of data.nodes) {
            if (node.row !== -1) continue;
            node.row = nextRow++;
            for (let neighbor of node.neighbors) {
                if (neighbor.row === -1) {
                    neighbor.row = nextRow++;
                }
            }
        }
    }

    function orderLinks(data) {
        const nodeMap = Object.fromEntries(data.nodes.map((d, i) => [d.id, i]));

        for (let i = 0; i < data.links.length; i++) {
            const link = data.links[i];
            const source = data.nodes[nodeMap[link.source]];
            const target = data.nodes[nodeMap[link.target]];
            link.row = Math.min(source.row, target.row);
            link.height = Math.abs(source.row - target.row);
            link.index = i;
        }

        data.links.sort((a, b) => a.row !== b.row ? a.row - b.row : a.height - b.height);

        for (let i = 0; i < data.links.length; i++) {
            data.links[i].index = i;
        }
    }

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
    
function drawNetwork() {
    data = JSON.parse(JSON.stringify(sampleData));  // Deep copy

    // Prepare chart area
    const chart = document.getElementById('chart');
    const rect = chart.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;

    d3.select("#chart").selectAll("*").remove();
    svg = d3.select("#chart").append("svg")
        .attr("viewBox", `0 0 ${width} ${height}`)
        .attr("preserveAspectRatio", "xMidYMid meet");

    // Map projection
    const projection = d3.geoMercator()
        .center([8.3, 46.8]) // Switzerland center
        .scale(5000)
        .translate([width / 2, height / 2]);

// Load and draw Switzerland map
d3.json(SWISSMAP).then(switzerland => {
    const geoPathGenerator = d3.geoPath().projection(projection);

    // append map first so it stays in the background
    svg.insert("g", ":first-child")   // ensures map-layer is behind links/nodes
        .attr("class", "map-layer")
        .selectAll("path")
        .data(switzerland.features)
        .join("path")
        .attr("d", geoPathGenerator)
        .attr("fill", "#f5f5f5")       // lighter background
        .attr("stroke", "#aaa")        // softer borders
        .attr("stroke-width", 0.5)
        .attr("fill-opacity", 0.6)     // semi-transparent fill
        .attr("stroke-opacity", 0.6);  // semi-transparent stroke
});


    // Parse coordinates (e.g., latitude, longitude) from string format
function parseCoords(coordStr) {
    if (typeof coordStr === "string" && coordStr.includes(",")) {
        const coords = coordStr.split(",").map(s => parseFloat(s.trim()));
        if (coords.length === 2 && !coords.some(isNaN)) {
            // Return coordinates as [longitude, latitude] for projection
            return [coords[1], coords[0]];
        }
    }
    return null;  // Return null if coordinates are not valid
}

    // Colors by node group
    topicColorMap = d3.scaleOrdinal()
        .domain([...new Set(data.nodes.map(d => d.group))])
        .range(d3.schemeTableau10);

    // Position nodes (use coords if available, else fallback)
    let themaIndex = 0;
    nodes = data.nodes.map(d => {
        const coords = parseCoords(d.koordinaten);
        if (coords) {
            const [xProj, yProj] = projection(coords);
            d.x = xProj;
            d.y = yProj;
        } else if (d.group === "thema") {
            themaIndex++;
            d.x = 100;
            d.y = 50 + themaIndex * 30;
            svg.append("text")
                .attr("x", d.x + 15)
                .attr("y", d.y + 5)
                .text(d.id)
                .attr("font-size", 12)
                .attr("fill", "#333")
                .attr("font-family", "sans-serif");
        } else {
            d.x = 150;
            d.y = 150;
        }
        return d;
    });

    // Build links with node references
    const nodeById = new Map(nodes.map(d => [d.id, d]));
    links = data.links.map(l => ({
        ...l,
        source: nodeById.get(l.source),
        target: nodeById.get(l.target)
    }));

    // Draw links
    //link = svg.append("g")
    //    .attr("class", "link")
    //    .selectAll("line")
    //    .data(links)
    //    .join("line")
    //    .attr("stroke", "#aaa")
    //    .attr("stroke-width", 2)
    //    .attr("x1", d => d.source.x)
    //    .attr("y1", d => d.source.y)
    //    .attr("x2", d => d.target.x)
    //    .attr("y2", d => d.target.y)
    //    .attr("stroke-opacity", 0.6);

    // Draw nodes
    node = svg.append("g")
        .attr("class", "node")
        .selectAll("circle")
        .data(nodes)
        .join("circle")
        .attr("r", 6)
        .attr("fill", d => topicColorMap(d.group))
        .attr("stroke", "#fff")
        .attr("stroke-width", 1.5)
        .attr("cx", d => d.x)
        .attr("cy", d => d.y);

    node.append("title").text(d => d.id);

    createBiofabric();
}


    function resetVisualization() {
        if (isAnimating) return;


        // Clear chart
        d3.select("#chart").selectAll("*").remove();
        
        fetch(DATA_URL)
        .then(response => response.json())
        .then(json => {
            sampleData = json;
            data = JSON.parse(JSON.stringify(sampleData));
            drawNetwork(); 
        })
        .catch(error => console.error('Error loading JSON:', error));
        // Reset button states
        document.getElementById('startBtn').disabled = false;
        document.getElementById('startBtn2').disabled = false;
        document.getElementById('resetBtn').disabled = true;
    }


   
