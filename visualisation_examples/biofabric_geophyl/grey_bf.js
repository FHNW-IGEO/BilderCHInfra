function createBiofabric() {
    d3.select("#biofabric").selectAll("*").remove();

    const rect = document.getElementById('biofabric').getBoundingClientRect();
    const width = rect.width / 2;
    const height = rect.height;

    const svgBF = d3.select("#biofabric").append("svg")
        .attr("width", width)
        .attr("height", height);

    // add group for content
    const g = svgBF.append("g");

    // squeeze factors (tweak as needed)
    const squeezeX = 0; // horizontal compression
    const squeezeY = 0;  // vertical compression

    // scales
    const y = d3.scaleLinear()
        .domain([0, nodes.length - 1])
        .range([margin.top, height - margin.bottom - squeezeY]);

    const x = d3.scaleLinear()
        .domain([0, links.length - 1])
        .range([margin.left, width - margin.right - squeezeX]);

    // horizontal lines (nodes)
    g.append("g")
        .attr("class", "node_lines")
        .selectAll("line")
        .data(nodes)
        .join("line")
        .attr("stroke-width", 2)
        .attr("stroke", "gray")
        .attr("stroke-opacity", 0.2)
        .attr("x1", margin.left)
        .attr("x2", width - margin.right - squeezeX)
        .attr("y1", (d, i) => y(i))
        .attr("y2", (d, i) => y(i));

    // vertical links
    g.append("g")
        .attr("class", "link")
        .selectAll("line")
        .data(links)
        .join("line")
        .attr("stroke-width", 2)
        .attr("stroke", "#555")
        .attr("x1", (d, i) => x(i))
        .attr("x2", (d, i) => x(i))
        .attr("y1", d => y(nodes.indexOf(d.source)))
        .attr("y2", d => y(nodes.indexOf(d.target)));

    // caps (top)
    g.append("g")
        .selectAll("rect")
        .data(links)
        .join("rect")
        .attr("width", 4)
        .attr("height", 4)
        .attr("fill", "#555")
        .attr("rx", 2)
        .attr("ry", 2)
        .attr("x", (d, i) => x(i) - 2)
        .attr("y", d => y(nodes.indexOf(d.source)) - 2);

    // caps (bottom)
    g.append("g")
        .selectAll("rect")
        .data(links)
        .join("rect")
        .attr("width", 4)
        .attr("height", 4)
        .attr("fill", "#555")
        .attr("rx", 2)
        .attr("ry", 2)
        .attr("x", (d, i) => x(i) - 2)
        .attr("y", d => y(nodes.indexOf(d.target)) - 2);

    // labels (below lines)
    g.append("g") 
        .attr("class", "labels") 
        .selectAll("text") 
        .data(nodes) 
        .join("text") 
        .text(d => d.id) 
        .attr("x", margin.left - 10) 
        .attr("y", (d, i) => y(i)) 
        .attr("dy", "0.35em") 
        .attr("font-size", 12) 
        .attr("text-anchor", "end") 
        .attr("font-family", "sans-serif") 
        .attr("fill", "#000"); 
    }
