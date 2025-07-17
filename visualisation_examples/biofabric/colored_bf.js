function createChart() {
    
    const nodeLines = svg.append("g")
        .attr("class", "node_lines")
        .selectAll("line")
        .data(nodes)
        .join("line")
        .attr("stroke-width", 2)
        .attr("stroke", color)
        .attr("x1", d => d.x)
        .attr("y1", d => d.y)
        .attr("x2", d => d.x)
        .attr("y2", d => d.y);

    // on nodeLines (horizontal lines)
    nodeLines
        .on("mouseover", function(event, d) {
            // d is the node this horizontal line represents
            nodeLines.classed("dimmed", true);
            link.classed("dimmed", true);

            d3.select(this).classed("dimmed", false); // keep this line visible

            // highlight all vertical link lines connected to this node
            link.filter(l => l.source.id === d.id || l.target.id === d.id)
                .classed("dimmed", false);
        })
        .on("mouseout", function() {
            nodeLines.classed("dimmed", false);
            link.classed("dimmed", false);
        });

    // on vertical links
    link
        .on("mouseover", function(event, l) {
            nodeLines.classed("dimmed", true);
            link.classed("dimmed", true);

            d3.select(this).classed("dimmed", false); // keep this vertical line visible

            // highlight the horizontal lines corresponding to source and target nodes
            nodeLines.filter(n => n.id === l.source.id || n.id === l.target.id)
                .classed("dimmed", false);
        })
        .on("mouseout", function() {
            nodeLines.classed("dimmed", false);
            link.classed("dimmed", false);
        });


    return {svg, link, node, nodeLines, nodes, links};
}

function startAnimation() {
    if (isAnimating) return;
    isAnimating = true;
    document.getElementById('startBtn').disabled = true;
    document.getElementById('resetBtn').disabled = false;
    document.getElementById('startBtn2').disabled = true;

    const {svg, link, node, nodeLines, nodes} = createChart();
    const duration1 = 1500;
    const duration2 = 2000;
    const duration3 = 2500;
    const duration4 = 3000;
    const duration5 = 3500;

    const t1 = svg.transition().duration(duration1);
    const t2 = svg.transition().delay(duration1).duration(duration2);
    const t3 = svg.transition().delay(duration1 + duration2).duration(duration3);

    nodeLines.transition(t1)
        .attr("x1", margin.left)
        .attr("y1", d => d.y)
        .attr("x2", width - margin.right)
        .attr("y2", d => d.y);

    svg.select(".link").raise();
    svg.select(".node").raise();

    node.transition(t2)
        .attr("cy", d => y(d.row));

    nodeLines.transition(t2)
        .attr("y1", d => y(d.row))
        .attr("y2", d => y(d.row));

    link.transition(t2)
        .attr("y1", d => y(d.source.row))
        .attr("y2", d => y(d.target.row));

    link.transition(t3)
        .attr("stroke-width", 2)
        .attr("x1", d => x(d.index))
        .attr("x2", d => x(d.index));

    node.transition()
        .delay(duration1 + duration2)
        .duration(duration1)
        .attr("opacity", 0);

    nodeLines.transition()
        .delay(duration1 + duration2 + duration3)
        .duration(duration5)
        .attr("x1", d => x(d.minCol))
        .attr("x2", d => x(d.maxCol));

    const labels = svg.append("g")
        .attr("class", "labels")
        .attr("font-size", 12)
        .attr("text-anchor", "end")
        .attr("dominant-baseline", "middle")
        .attr("font-family", "sans-serif")
        .selectAll("text")
        .data(nodes)
        .join("text")
        .text(d => d.id)
        .attr("x", 0)
        .attr("y", d => y(d.row))
        .attr("stroke-width", 2)
        .attr("stroke", "white")
        .attr("stroke-linejoin", "round");

    labels.clone(true)
        .attr("stroke", "none")
        .attr("fill", "black");

    svg.selectAll(".labels text")
        .transition()
        .delay(duration1 + duration2 + duration3 + duration4)
        .duration(duration5)
        .attr("x", d => x(d.minCol) - 5);

    setTimeout(() => {isAnimating = false;}, 6000);
}

document.getElementById('startBtn').addEventListener('click', startAnimation);
document.getElementById('resetBtn').addEventListener('click', resetVisualization);
document.addEventListener('DOMContentLoaded', resetVisualization);