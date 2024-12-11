import {Runtime, Library, Inspector} from "../external/js/runtime.unminified.noparamsdisplay.js";

function _chart(d3,width,height,chord,matrix,DOM,outerRadius,ribbon,ribbonColor,names,formatValue,arc,title,minNumInts,maxNumInts,plotCnt,
                microenvironments, microenvironment2cell_types, cell_type2microenvironments)
{
    if (maxNumInts == 0) {
        return;
    }

    // Map each cell type label to its microenvironment colour if provided; black if no microenvironments provided
    // or cell type corresponds to multiple microenvironments
    var me2Colour = {};
    var ct2Colour = {};
    // See: https://observablehq.com/@d3/color-schemes
    const colours = d3.schemeCategory10;
    var me2Colour = {};
    if (microenvironments) {
      for (var i = 0; i < microenvironments.length; i++) {
          const me = microenvironments[i];
          if (microenvironment2cell_types[me] != undefined) {
            me2Colour[me] = colours[i % colours.length];
          }
      }
    }
    for (var i = 0; i < names.length; i++) {
        var ct = names[i];
        if (microenvironments && plotCnt == 0) {
            if (cell_type2microenvironments[ct] != undefined && cell_type2microenvironments[ct].length == 1) {
                me = cell_type2microenvironments[ct][0];
                ct2Colour[ct] = me2Colour[me];
            } else {
                // ct maps to multiple microenvironments
                me2Colour['multiple'] = 'black';
                ct2Colour[ct] = me2Colour['multiple'];
            }
        } else {
            // No microenvironments were provided, or they were but it's a microenvironment-specific plot => show all cell type labels in black
            ct2Colour[ct] = 'black';
        }
    }
    console.log("GOT WIDTH ", width)

    const svg = d3.create("svg")
        .attr("width", width*1.6)
        .attr("height", height*1.6)
        .attr("viewBox", [-width / 1.6, -height / 1.6, width + 50, height + 50]);

    // Insert title
    svg.append("text")
        .attr("x", -width / 2 + (width + 50)/2 - title.length*4)
        .attr("y", -height * 0.45)
        .style("font-size", "12px")
        .attr("font-weight", 400)
        .text(title)

    const chords = chord(matrix);

    const textId = DOM.uid("text");

    svg.append("path")
        .attr("id", textId.id)
        .attr("fill", "none")
        .attr("d", d3.arc()({outerRadius, startAngle: 0, endAngle: 2 * Math.PI}));

    svg.append("g")
        .attr("fill-opacity", 0.75)
    .selectAll("g")
    .data(chords)
    .join("path")
        .attr("d", ribbon)
        .attr("fill", d => ribbonColor(d.target.value))
        .style("mix-blend-mode", "multiply")
    // The following acts as a tooltip over a ribbon
    .append("title")
        .text(d => `${names[d.source.index]} - ${names[d.target.index]} : ${formatValue(d.source.value)} interactions`);

    // Work our parameters for placement of labels
    // NB. Maximum 4 levels of spread for labels
    const label_spread_factor = Math.min(4, Math.round(names.length/10) + 1);
    var total_connections_per_ct = [];
    for (var i = 0; i < matrix.length; i++) {
       total_connections_per_ct.push(d3.sum(matrix[i]) + d3.deviation(matrix, row => row[i]));
    }
    const no_spread_cutoff = d3.mean(total_connections_per_ct) + 2 * d3.deviation(total_connections_per_ct);

    svg.append("g")
        .attr("font-family", "sans-serif")
        .attr("font-size", 8)
    .selectAll("g")
    .data(chords.groups)
    .join("g")
        .call(g => g.append("path")
        .attr("d", arc)
        // Set the colour of the outer ring to light grey
        .attr("fill", d => "#B9BBB6")
        .attr("stroke", "#fff"))
        .call(
    g => g.append("text")
      .each(d => (d.angle = (d.startAngle + d.endAngle) / 2))
      .attr("dy", "0.35em")
      .attr("transform", d => `
        rotate(${(d.angle * 180 / Math.PI - 90)})
        translate(${outerRadius + 5})
        ${d.angle > Math.PI ? "rotate(180)" : ""}
      `)
      .attr("text-anchor", d => d.angle > Math.PI ? "end" : null)
      .text(d => names[d.index])
      .style("fill", d => ct2Colour[names[d.index]])
      )

        // The following acts as a tooltip over a an outer ring corresponding to a cell type
        .call(g => g.append("title")
        .text(d => `${names[d.index]}
${formatValue(d3.sum(matrix[d.index]))} outgoing interactions
${formatValue(d3.sum(matrix, row => row[d.index]))} incoming interactions`));

   // Display ribbon colour legend bar
    var min_ints = parseInt(minNumInts);
    var max_ints = parseInt(maxNumInts);
    const ribbonColorScale = d3
      .scaleSequential()
      .domain([max_ints, min_ints])
      // See: https://observablehq.com/@d3/sequential-scales
      .interpolator(d3.interpolateRdYlBu)

    var legend_width=30,
    legend_height=100,
    legend_xPos= -width/1.7,
    title_xPos = legend_xPos * 0.5;
    var legend_yPos;
    if (plotCnt > 0) {
        legend_yPos=-45;
    } else {
        // Make space for microenvironments categorical colour legend
        legend_yPos=-165;
    }

  // Ribbon Colour legend:
  // See: https://blog.scottlogic.com/2019/03/13/how-to-create-a-continuous-colour-range-legend-using-d3-and-d3fc.html
  // Band scale for x-axis

  const domain=[min_ints, max_ints]
  const legend_xScale = d3
    .scaleBand()
    .domain([0, 1])
    .range([0, legend_width]);

  // Linear scale for y-axis
  const legend_yScale = d3
    .scaleLinear()
    .domain(domain)
    .range([legend_height, 0]);

  // An array interpolated over our domain where height is the height of the bar
  // Padding the domain by 3%
  // This will have an effect of the bar being 3% longer than the axis label
  // (otherwise top/bottom figures on the legend axis would be cut in half)
  const paddedDomain = fc.extentLinear()
    .pad([0.03, 0.03])
    .padUnit("percent")(domain);
  [min_ints, max_ints] = paddedDomain;
  const expandedDomain = d3.range(min_ints, max_ints, (max_ints - min_ints) / legend_height);

  // Define the colour legend bar
  const svgBar = fc
    .autoBandwidth(fc.seriesSvgBar())
    .xScale(legend_xScale)
    .yScale(legend_yScale)
    .crossValue(0)
    .baseValue((_, i) => (i > 0 ? expandedDomain[i - 1] : min_ints))
    .mainValue(d => d)
    .decorate(selection => {
      selection.selectAll("path").style("fill", d => ribbonColorScale(d));
    });

    // Add the colour legend header
    svg
    .append("text").attr("x", legend_xPos - 7).attr("y", legend_yPos - 30).text("Number of").style("font-size", "10px")
    .append('tspan').attr("x", legend_xPos - 7).attr("y", legend_yPos - 20).text("interactions")
    .attr("alignment-baseline","middle");

  // Draw the legend bar
  const colourLegendBar = svg
    .append("g")
    .attr("transform", function() {
        return "translate(" + legend_xPos + "," + legend_yPos + ")";
      })
    .datum(expandedDomain)
    .call(svgBar);

  // Linear scale for legend label
  const legendLabel_yScale = d3
    .scaleLinear()
    .domain(paddedDomain)
    .range([legend_height, 0]);

  // Defining our label
  const axisLabel = fc
    .axisRight(legendLabel_yScale)
    .tickValues([...domain, (domain[1] + domain[0]) / 2])
    .tickSizeOuter(0);

  // Drawing and translating the label
  colourLegendBar.append("g")
    // .attr("transform", `translate(${barWidth})`)
    .attr("transform", "translate(" + 15 + ")")
    .datum(expandedDomain)
    .call(axisLabel)
    .select(".domain")
    .attr("visibility", "hidden");
  // Display ribbon colour legend bar - end

  // Display cell type labels colour legend - per microenvironment - for the 'all cell types' plot only
  if (microenvironments && plotCnt == 0) {
      // Legend for cell type colours - by micro-environment
      const meLegend_xPos=legend_xPos-12;
      var meLegend_yPos = legend_yPos + legend_height - 30;

      const meLegenedWidth = 600;
      const meLegendHeight = 500;
      const meLegend = svg
            .append("svg")
            .attr("width", meLegenedWidth)
            .attr("height", meLegendHeight)
            .attr("x", meLegend_xPos)
            .attr("y", meLegend_yPos);

      // Microenvironments legend header
      meLegend
        .append("text").attr("x", 0).attr("y", 80).text("Microenvironments").style("font-size", "10px")
        .attr("alignment-baseline","middle")

      // Microenvironments legend content
      const size = 12;
      const meLegendStartYPos = 100;
      var meLegendYPos = meLegendStartYPos;
      for (var me in me2Colour) {
          var colour = me2Colour[me];
          meLegend.append("rect").attr("x",0).attr("y",meLegendYPos).attr("width", size).attr("height", size).style("fill", colour)
          meLegend.append("text").attr("x", 20).attr("y", meLegendYPos+6).text(me).style("font-size", "10px").attr("alignment-baseline","middle");
          meLegendYPos += 20;
      }
  }

  return svg.node();
}

function _names(data){return(
    Array.from(new Set(data.flatMap(d => [d.source, d.target])))
)}

function _matrix(names,data)
{
    const index = new Map(names.map((name, i) => [name, i]));
    const matrix = Array.from(index, () => new Array(names.length).fill(0));
    for (const {source, target, value} of data) matrix[index.get(source)][index.get(target)] += value;
    return matrix;
}


function _chord(d3,innerRadius){return(
d3.chordDirected()
    .padAngle(12 / innerRadius)
    .sortSubgroups(d3.descending)
    .sortChords(d3.descending)
)}

function _arc(d3,innerRadius,outerRadius){return(
d3.arc()
    .innerRadius(innerRadius)
    .outerRadius(outerRadius)
)}

function _ribbon(d3,innerRadius){return(
d3.ribbon()
    .radius(innerRadius - 0.5)
    .padAngle(1 / innerRadius)
)}

function d3_rgbString (value) {
    return d3.rgb(value >> 16, value >> 8 & 0xff, value & 0xff);
}

function _ribbonColor(d3,minNumInts, maxNumInts){
  return(d3
  .scaleSequential()
  .domain([maxNumInts, minNumInts])
  .interpolator(d3.interpolateRdYlBu)
)}

function _formatValue(){return(
x => `${x.toFixed(0)}` 
)}


function _outerRadius(innerRadius){return(
innerRadius + 6
)}

function _innerRadius(width,height){return(
Math.min(width, height) * 0.5 - 20
)}

function _width(){return(
840
)}

function _height(width){return(
width
)}

function _d3(require){return(
require("d3@6")
)}

function define(main, observer, data, title, plotCnt, min_num_ints, max_num_ints, microenvironments, microenvironment2cell_types, cell_type2microenvironments) {
     main.variable(observer("chart")).define("chart", ["d3","width","height","chord","matrix","DOM","outerRadius","ribbon",
     "ribbonColor","names","formatValue","arc","title","minNumInts","maxNumInts","plotCnt","microenvironments","microenvironment2cell_types","cell_type2microenvironments"], _chart);
     main.variable(observer("data")).define("data", [], data);
     main.variable(observer("title")).define("title", [], title);
     main.variable(observer("names")).define("names", ["data"], _names);
     main.variable(observer("matrix")).define("matrix", ["names","data"], _matrix);
     main.variable(observer("chord")).define("chord", ["d3","innerRadius"], _chord);
     main.variable(observer("arc")).define("arc", ["d3","innerRadius","outerRadius"], _arc);
     main.variable(observer("ribbon")).define("ribbon", ["d3","innerRadius"], _ribbon);
     main.variable(observer("ribbonColor")).define("ribbonColor", ["d3","minNumInts","maxNumInts"], _ribbonColor);
     main.variable(observer("formatValue")).define("formatValue", _formatValue);
     // all cell types default
     var innerRadius = 200;
     var outerRadius = 206;
     var size = 800;
     if (plotCnt > 0) {
        // microenvironments
        innerRadius = 70;
        outerRadius = 76;
        size = 300;
     }
     main.variable(observer("outerRadius")).define("outerRadius", ["innerRadius"], outerRadius);
     main.variable(observer("innerRadius")).define("innerRadius", ["width","height"], innerRadius);
     main.variable(observer("width")).define("width", size);
     main.variable(observer("height")).define("height", ["width"], size);
     main.variable(observer("minNumInts")).define("minNumInts", [], min_num_ints);
     main.variable(observer("maxNumInts")).define("maxNumInts", [], max_num_ints);
     main.variable(observer("plotCnt")).define("plotCnt", [], plotCnt);
     main.variable(observer("microenvironments")).define("microenvironments", [], microenvironments);
     main.variable(observer("microenvironment2cell_types")).define("microenvironment2cell_types", [], microenvironment2cell_types);
     main.variable(observer("cell_type2microenvironments")).define("cell_type2microenvironments", [], cell_type2microenvironments);
     main.variable(observer("d3")).define("d3", ["require"], _d3);
 }

 export default function generateCellCellInteractionSummaryChordPlot(data, cellTypes, title, plotCnt, min_num_ints, max_num_ints) {
    const num_ints_csv = filterNumInteractions(data, cellTypes, false, plotCnt);
    // See: https://observablehq.com/@observablehq/advanced-embeds
    // See: https://observablehq.com/@observablehq/stdlib
    // See: https://github.com/observablehq/inspector
    // See: https://github.com/observablehq/runtime
    const runtime = new Runtime();
    const module = runtime.module();
    const plotId = "#cci"+plotCnt + "_chord";
    // Remove any previous chord plot first
    $(plotId).empty();
    const observer = Inspector.into(document.querySelector(plotId));
    const chordData = d3.csvParse(num_ints_csv, d3.autoType);
    define(module, observer, chordData, title, plotCnt, min_num_ints, max_num_ints, data['microenvironments'], data['microenvironment2cell_types'], data['cell_type2microenvironments']);
 }