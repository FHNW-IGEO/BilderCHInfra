## BioFabric
1. **Initial Graph Setup**
Each node is enriched with:
- degree: number of connections.
- neighbors: a list of directly connected nodes.
- row: initialized to -1, to be set later.
- minCol / maxCol: to track where vertical links (columns) intersect the node.
This prepares metadata needed for layout logic.
Purpose: Place high-degree nodes earlier (top of the chart), helping to visually cluster more connected components.
2. **Row Assignment (assignRows)**
Each node is assigned a unique row number (vertical position):
Then, its unassigned neighbors are also placed in subsequent rows.
Purpose: Nodes are positioned top-to-bottom by connectivity, but not in a deeply hierarchical manner. It avoids overlap while grouping connected nodes close together.
3. **Link Ordering (orderLinks)**
Each link is assigned:
- row: minimum of source/target node’s row
- height: absolute difference between source and target rows
Then links are sorted by:
- row ascending (so links tied to higher-up nodes come first),
- height ascending (shorter links first).
This gives each link a unique index that determines its column position (i.e. horizontal line in BioFabric).
4. **Range Computation (computeRanges)**
For each node, we update:
- minCol: leftmost column (link) connected to it
- maxCol: rightmost column
5. Final Positioning: Scales x and y
Nodes are placed on horizontal bands using d3.scaleBand(). So each node gets a vertical position based on its row index. Links are placed on vertical bands: So each link gets a horizontal position based on its link index.

**Summary - functions in main.js**
- initGraph	Prepares node/link metadata
- orderNodes	Sorts nodes by degree for clearer layout
- assignRows	Assigns each node a unique row
- orderLinks	Assigns each link a unique column (based on rows)
- computeRanges	Tracks min/max columns for each node
- x and y scales	Define layout axes for BioFabric
