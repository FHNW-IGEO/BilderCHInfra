    let sampleData = {};
    let data, svg, simulation;
    let nodes, links, link, node;
    let y, x;
    let isAnimating = false;

    fetch('kraftwerke.json')
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
    
    function drawNetwork(){
    
        data = JSON.parse(JSON.stringify(sampleData));
        initGraph(data);
        orderNodes(data);
        assignRows(data);
        orderLinks(data);
        computeRanges(data);

        const chart = document.getElementById('chart');
        const rect = chart.getBoundingClientRect();
        const width = rect.width;
        const height = rect.height;

        y = d3.scaleBand()
            .domain(d3.range(data.nodes.length))
            .range([margin.top, height - margin.bottom])
            .padding(0.1);

        x = d3.scaleBand()
            .domain(d3.range(data.links.length))
            .range([margin.left, width - margin.right])
            .padding(0.1);

        links = data.links.map(d => Object.create(d));
        nodes = data.nodes.map(d => Object.create(d));

        simulation = d3.forceSimulation(nodes)
            .force("link", d3.forceLink(links).id(d => d.id))
            .force("charge", d3.forceManyBody())
            .force("center", d3.forceCenter(width / 2, height / 2))
            .tick(300);

        d3.select("#chart").selectAll("*").remove();

        svg = d3.select("#chart").append("svg")
            .attr("viewBox", `0 0 ${width} ${height}`)
            .attr("preserveAspectRatio", "xMidYMid meet");

        link = svg.append("g")
            .attr("class", "link")
            .attr("stroke", "black")
            .selectAll("line")
            .data(links)
            .join("line")
            .attr("stroke-width", 1);

        node = svg.append("g")
            .attr("class", "node")
            .attr("stroke", "#fff")
            .attr("stroke-width", 1.5)
            .selectAll("circle")
            .data(nodes)
            .join("circle")
            .attr("r", 5)
            .attr("fill", "red");

        node.append("title").text(d => d.id);

        simulation.on("end", () => {
            link
                .attr("x1", d => d.source.x)
                .attr("y1", d => d.source.y)
                .attr("x2", d => d.target.x)
                .attr("y2", d => d.target.y);

            node
                .attr("cx", d => d.x)
                .attr("cy", d => d.y);
        });
        
    }

    function resetVisualization() {
        if (isAnimating) return;


        // Clear chart
        d3.select("#chart").selectAll("*").remove();
        
        fetch('kraftwerke.json')
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

   