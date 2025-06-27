export function transformToCirclePack(nodesData, svg, nodeGroup, mapLayer, legendBox, link, projection) {
    svg.selectAll("path").transition().duration(1000).style("opacity", 0).on("end", function() {
        d3.select(this).remove();
    });
    // Hide map view & legend
    nodeGroup.selectAll("circle").style("opacity", 1);
    link.transition().duration(1000).style("opacity", 0);
    mapLayer.transition().duration(2000).ease(d3.easeLinear).style("opacity", 0);
    legendBox.transition().duration(1000).ease(d3.easeLinear).style("opacity", 0);
    // Disable drag behavior
    nodeGroup.on(".drag", null);
    const rootNodes = nodesData.filter(d => d.group === "thema");
    const rootData = {
        name: "root",
        children: rootNodes.map(rootNode => {
            const children = nodesData.filter(
                d => d.group === rootNode.id && d !== rootNode
            );
            return {
                ...rootNode,
                children: children
            };
        })
    };
    const root = d3.hierarchy(rootData)
        .sum(d => d.children ? 1 : 10)
        .sort((a, b) => b.value - a.value);
    const packLayout = d3.pack()
        .size([svg.attr("width") / 1.5, svg.attr("height") / 1.5])
        .padding(1);
    packLayout(root);
    const radiusMap = new Map(root.descendants().map(d => [d.data.id, d.r]));
    const themaNodes = nodeGroup.filter(d => d.group === "thema");
    const nodeNodes = nodeGroup.filter(d => d.group !== "thema");
    // Position children nodes
    nodeNodes.transition()
        .duration(2000)
        .attr("transform", function(d, i, nodes) {
            const isSelected = d3.select(nodes[i]).classed("selected-node");
            const target = root.descendants().find(n => n.data.id === d.id);
            if (isSelected) {
                return d3.select(nodes[i]).attr("transform");
            }
            return target ? `translate(${target.x},${target.y})` : "translate(-1000,-1000)";
        });

    // Position thema nodes (optional, if needed)
    themaNodes.lower().transition()
        .duration(2000)
        .attr("transform", function(d, i, nodes) {
            const isSelected = d3.select(nodes[i]).classed("selected-node");
            const target = root.children.find(n => n.data.id === d.id);
            if (isSelected) {
                return d3.select(nodes[i]).attr("transform");
            }
            return target ? `translate(${target.x},${target.y})` : "translate(-1000,-1000)";
        });
    // Style thema node circles
    themaNodes.selectAll("circle")
        .transition()
        .duration(2000)
        .attr("r", d => radiusMap.get(d.id) || 0)
        .style("fill", d => d.color || "#ccc")
        .style("stroke", "#666")
        .style("stroke-width", 2)
        .style("opacity", 0.3);
    // Thema labels
        // Stop hover events for thema nodes
themaNodes.on("mouseover", null).on("mouseout", null);


    themaNodes.selectAll("text")
        .lower()
        .transition().delay(2000)
        .attr("text-anchor", "middle")
        .attr("y", d => -((radiusMap.get(d.id) || 0) - 25))
        .attr("dx", null)
        .style("font-size", "14px")
        .style("font-weight", "bold")
        .style("opacity", 1)
        .style("pointer-events", "none");

    // Style node circles
    nodeNodes.selectAll("circle")
        .transition()
        .duration(2000)
        .attr("r", d => radiusMap.get(d.id) || 0)
        .style("fill", function(d, i, nodes) {
            console.log(nodes[i])
            if (d3.select(nodes[i]).classed("selected-node")) return null;
            const parent = root.children.find(n => n.data.id === d.group);
            return parent ? (parent.data.color || "#eee") : null;
        })
        .style("stroke-width", (d, i, nodes) =>
            d3.select(nodes[i]).classed("selected-node") ? null : 4
        )

        
        .style("opacity", (d, i, nodes) =>
            d3.select(nodes[i]).classed("selected-node") ? null : 1
        );

    nodeNodes
        .on("mouseover", function(event, d) {
            const label = d3.select(this).select("text");
            const radius = d.r || 20; // fallback if radius is undefined
            const words = d.name.split(" ");
            const lineHeight = 12;
            const totalHeight = words.length * lineHeight;
            const startY = -totalHeight / 2 + lineHeight / 2;
            label
                .text("")
                .style("opacity", 1)
                .attr("text-anchor", "middle")
                .attr("dy", null)
                .attr("dx", null);
            label.selectAll("tspan").remove(); // double-clear, for safety
            words.forEach((word, index) => {
                label.append("tspan")
                    .attr("x", 0)
                    .attr("y", startY + index * lineHeight)
                    .text(word);
            });
        })
        .on("mouseout", function(event, d) {
            const label = d3.select(this).select("text");
            label
                .style("opacity", 0)
                .text(d.name) // restore original label, if needed
                .selectAll("tspan").remove();
        });  
        
        
    }    

export default transformToCirclePack