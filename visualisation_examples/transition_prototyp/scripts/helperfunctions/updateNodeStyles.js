export function updateNodeStyles(minVal, maxVal) {
        const currentYear = new Date().getFullYear(); // Get the current year
        // Track which nodes are affected by visibility change
        const affectedNodes = new Set();
        d3.selectAll("circle").each(function(d) {
            // If d.bis is "Aktiv", set it to the current year
            if (d.bis === "Aktiv") {
                d.bis = currentYear;
            }
            let nodeChanged = false;
            // Apply styles based on the updated year values
            if (d.von >= minVal && d.bis <= maxVal) {
                d3.select(this).style("opacity", 1).style("filter", "none");
            } else if (minVal <= d.von && maxVal <= d.bis) {
                d3.select(this).style("opacity", 0.2).style("filter", "none");
                nodeChanged = true;
            } else if (minVal >= d.von && maxVal >= d.bis) {
                d3.select(this).style("opacity", 1).style("filter", "grayscale(100%)");
                nodeChanged = true;
            } else {
                d3.select(this).style("opacity", 1).style("filter", "none");
            }
            if (nodeChanged) {
                affectedNodes.add(d.id);
            }
        });
        d3.selectAll("line").each(function() {
            const link = d3.select(this).datum(); // safely get the bound data
            if (link?.source?.id && link?.target?.id) {
                if (affectedNodes.has(link.source.id) || affectedNodes.has(link.target.id)) {
                    d3.select(this).style("opacity", 0.1);
                } else {
                    d3.select(this).style("opacity", 1);
                }
            }
        });
    }

    export default updateNodeStyles