import * as drag from "../helperfunctions/drag.js";

export function resetToInitialPositions(nodeGroup, initialPositions, legendBox, mapLayer, link, simulation, svg, selectedNode) {
    svg.selectAll("path")
        .transition()
        .duration(1000)
        .style("opacity", 0)
        .on("end", function() {
            d3.select(this).remove();
        });

    nodeGroup.selectAll("circle").transition().duration(1000)
        .attr("r", d => d.group === "thema" ? 15 : 10).style("opacity", 1);

    link.transition().delay(3000).duration(1000).ease(d3.easeLinear).style("opacity", 1);

    nodeGroup.transition().delay(1000).duration(5000).selectAll("text").filter(function(d) {
        return d.group === "thema";
    }).style("opacity", 0);

    // Remove all labels from circle pack
    nodeGroup.selectAll("text").remove();

    nodeGroup.selectAll("circle")
        .on("mouseover", function(event, d) {
            d3.select(this.parentNode).select("text").style("opacity", 1);
        })
        .on("mouseout", function(event, d) {
            d3.select(this.parentNode).select("text").style("opacity", 0);
        });

    nodeGroup.transition().duration(4000)
        .attr("transform", d => {
            const pos = initialPositions[d.id] || {
                x: d.x,
                y: d.y
            };
            return `translate(${pos.x},${pos.y})`;
        })
        .on("end", function() {
            setTimeout(function() {
                link.transition().duration(10)
                    .attr("x1", d => {
                        const sourcePos = initialPositions[d.source.id] || {
                            x: d.source.x,
                            y: d.source.y
                        };
                        return sourcePos.x;
                    })
                    .attr("y1", d => {
                        const sourcePos = initialPositions[d.source.id] || {
                            x: d.source.x,
                            y: d.source.y
                        };
                        return sourcePos.y;
                    })
                    .attr("x2", d => {
                        const targetPos = initialPositions[d.target.id] || {
                            x: d.target.x,
                            y: d.target.y
                        };
                        return targetPos.x;
                    })
                    .attr("y2", d => {
                        const targetPos = initialPositions[d.target.id] || {
                            x: d.target.x,
                            y: d.target.y
                        };
                        return targetPos.y;
                    })
                    .style("opacity", 1);
            }, 0);

            // Reapply the link highlighting for the selected node
            if (selectedNode) {

                link.style("opacity", link => {
                    return (link.source.id === selectedNode.id || link.target.id === selectedNode.id) ? 1 : 0.2;
                })
                .style("stroke", link => {
                    return (link.source.id === selectedNode.id || link.target.id === selectedNode.id) ? "yellow" : "#999";
                })
                .style("stroke-width", link => {
                    return (link.source.id === selectedNode.id || link.target.id === selectedNode.id) ? 3 : 2;
                });
            }
        }).style("opacity", 1);

    legendBox.transition().duration(1000).ease(d3.easeLinear).style("opacity", 0);

    mapLayer.transition().duration(2000).ease(d3.easeLinear).style("opacity", 0);

    nodeGroup.call(drag.drag(simulation));
}

export default resetToInitialPositions