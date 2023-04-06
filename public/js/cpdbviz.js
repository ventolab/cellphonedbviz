document.addEventListener('DOMContentLoaded', function() {
    var projectName = 'endometrium_cpdbv4';
   //   Populate page title
   $.ajax({
            url: '/api/list',
            contentType: "application/json",
            dataType: 'json',
            success: function(res) {
                $("#page_header").text(res[projectName]);
                $("title").text(res[projectName]);
            }
    });
    // Generate cell type composition plot
    $.ajax({
            url: '/api/data/'+projectName+'/celltype_composition',
            contentType: "application/json",
            dataType: 'json',
            success: function(res) {
              var edges = res['edges'];
              $("#ctcomp_header").text(res['title']);
              var sankey = new Sankey('ctcomp');
              sankey.stack(0,res['list0'],res['y_space0'],res['y_box0']);
              sankey.stack(1,res['list1'],res['y_space1'],res['y_box1']);
              sankey.stack(2,res['list2'],res['y_space2'],res['y_box2']);
              sankey.stack(3,res['list3'],res['y_space3'],res['y_box3']);
              sankey.stack(4,res['list4'],res['y_space4'],res['y_box4']);
              sankey.stack(5,res['list5'],res['y_space5'],res['y_box5']);
              var elem2colour = {};
              // See: https://observablehq.com/@d3/color-schemes
              // const colours = d3.schemeTableau10.reverse();
              const colours = d3.schemePaired;
              var elems = res['all_elems'];
              for (var i = 0; i < elems.length; i++) {
                elem = elems[i];
                elem2colour[elem] = colours[i % colours.length];
              }
              // Colours
              sankey.setColors(elem2colour);
              sankey.y_space = 20;
              sankey.right_margin = 100;
              sankey.left_margin = 100;
              sankey.box_width = 60;
              // Box height
              sankey.convert_flow_values_callback = function(flow) {
                return flow * 0.05;
              };
              sankey.convert_flow_labels_callback = function(flow) {
                // return Math.round(flow);
                return "";
              };
              sankey.convert_box_value_labels_callback = function(flow) {
                // return (""+Math.round(flow))
                return "";
              };
              sankey.setData(edges);
              sankey.draw();
           }
    });

    // Generate spatial micro-environments plot
    $.ajax({
            url: '/api/data/'+projectName+'/celltype_composition',
            contentType: "application/json",
            dataType: 'json',
            success: function(res) {
         var spme_height = 450,
            spme_width = 550,
            spme_x_margin = 120,
            spme_y_margin = 70,
            yVals = res['y_vals'],
            yMin = -1,
            xMin = -1,
            yMax = yVals.length - 1,
            xVals = res['x_vals'],
            xMax= xVals.length - 1,
            mapping = res['raw_data'],
            colorDomain = res['color_domain'];
          $("#spme_header").text(res['title']);

          var svg = d3
            .select("#spme")
            .append("svg")
            .attr("class", "axis")
            .attr("width", spme_width)
            .attr("height", spme_height);

          var spme_yAxisLength = spme_height - 2 * spme_y_margin,
            spme_xAxisLength = spme_width - 2 * spme_x_margin;

          var spme_xScale = d3
              .scaleLinear()
              .domain([xMin, xMax])
              .range([0, spme_xAxisLength]),
              spme_yScale = d3
              .scaleLinear()
              .domain([yMax, yMin])
              .range([0, spme_yAxisLength]),
            colorscale = d3.scaleOrdinal()
              .domain(colorDomain)
              .range(d3.schemeTableau10);

          function renderXAxis() {
            var xAxis = d3
              .axisBottom()
              .ticks(xVals.length)
              .tickFormat(t => {
                return xVals[t];
              })
              .scale(spme_xScale);
            svg
              .append("g")
              .attr("class", "x-axis")
              .attr("id", "spme_x-axis")
              .attr("transform", function() {
                return "translate(" + spme_x_margin + "," + (spme_height - spme_y_margin) + ")";
              })
              .attr("opacity", 1)
              .call(xAxis)
              .selectAll("text")
              .style("text-anchor", "end")
              .attr("dx", "-.8em")
              .attr("dy", ".15em")
              .attr("transform", "rotate(-45)");

            d3.selectAll("#spme_x-axis g.tick")
              .append("line")
              .classed("grid-line", true)
              .attr("x1", 0)
              .attr("y1", 0)
              .attr("x2", 0)
              .attr("y2", -(spme_height - 2 * spme_y_margin));
          }

          function renderYAxis() {
            var yAxis = d3
              .axisLeft()
              .ticks(yVals.length)
              .tickFormat(t => {
                return yVals[t];
              })
              .scale(spme_yScale);
            svg
              .append("g")
              .attr("class", "y-axis")
              .attr("id", "spme_y-axis")
              .attr("transform", function() {
                return "translate(" + spme_x_margin + "," + spme_y_margin + ")";
              })
              .call(yAxis);

            d3.selectAll("#spme_y-axis g.tick")
              .append("line")
              .classed("grid-line", true)
              .attr("x1", 0)
              .attr("y1", 0)
              .attr("x2", spme_xAxisLength)
              .attr("y2", 0)
              .attr("fill", colorscale(0));
          }

          function renderPoint(x, y, colorPos) {
            svg
              .append("circle")
              .attr("transform", function() {
                return "translate(" + spme_x_margin + "," + spme_y_margin + ")";
              })
              .attr("cx", spme_xScale(x))
              .attr("cy", spme_yScale(y))
              .attr("fill", colorscale(colorPos))
              // .attr("r", spme_xScale(x)/25);
              .attr("r", 7);
          }

          renderYAxis();
          renderXAxis();
          for (var i = 0; i <= mapping.length - 1; i++) {
            vals = mapping[i];
            yPos = yVals.indexOf(vals[0]);
            xPos = xVals.indexOf(vals[2]);
            colorPos = colorDomain.indexOf(vals[1]);
            renderPoint(xPos, yPos, colorPos);
          }

          svg.selectAll("legend_dots")
            .data(colorDomain)
            .enter()
            .append("circle")
              .attr("cx", spme_width - 100)
              .attr("cy", function(d,i){ return spme_y_margin + i*25}) // 100 is where the first dot appears. 25 is the distance between dots
              .attr("r", 7)
              .style("fill", function(d){ return colorscale(colorDomain.indexOf(d))})

          svg.selectAll("legend_labels")
            .data(colorDomain)
            .enter()
            .append("text")
              .attr("x", spme_width - 80)
              .attr("y", function(d,i){ return spme_y_margin + i*25}) // 100 is where the first dot appears. 25 is the distance between dots
              .style("fill", function(d){ return colorscale(colorDomain.indexOf(d))})
              .text(function(d){ return d})
              .attr("text-anchor", "left")
              .style("alignment-baseline", "middle")
            }
    });

    // Generate single gene expression plot
    $.ajax({
            url: '/api/data/'+projectName+'/single_gene_expression',
            contentType: "application/json",
            dataType: 'json',
            success: function(res) {
                var unique_genes = [];
                for (var i = 0; i < res['gene_complex'].length; i++) {
                    gene = res['gene_complex'][i].split(" ")[0];
                    if (!unique_genes.includes(gene)) {
                        unique_genes.push(gene);
                    }
                }
                for (var i = 0; i < unique_genes.length; i++) {
                    store_token(unique_genes[i], "sge_selected_genes", "sge-gene-input");
                }
                for (var i = 0; i < res['all_cell_types'].length; i++) {
                    store_token(res['all_cell_types'][i], "sge_selected_celltypes", "sge-celltype-input");
                }
                var sge_height = 700,
                sge_width = 1000,
                sge_bottom_yMargin = 150,
                sge_top_yMargin = 30,
                sge_xMargin = 120,
                yVals = res['all_cell_types'],
                yMin = -1,
                xMin = -1,
                yMax = yVals.length - 1,
                // TODO: May need to restrict the maximum number of genes that can be displayed at any one time -
                // to keep the plot readable at all times (If necessary increase the plot size to accommodate the maximum
                // possible number of genes). Could the plot size be increased dynamically??
                xVals = res['gene_complex'],
                xMax= xVals.length - 1,
                mean_expressions = res['mean_expressions'],
                // min_expr, max_expr needed for color scale
                min_expr=res['min_expression'],
                max_expr=res['max_expression'],
                cellType2Degs = res['celltype2degs'],
                colorDomain = yVals
              var svg = d3
                .select("#sge")
                .append("svg")
                .attr("class", "axis")
                .attr("width", sge_width)
                .attr("height", sge_height);

              var sge_yAxisLength = sge_height - sge_top_yMargin - sge_bottom_yMargin,
                  sge_xAxisLength = sge_yAxisLength;

              var sge_xScale = d3
                  .scaleLinear()
                  .domain([xMin, xMax])
                  .range([0, sge_xAxisLength]),
                  sge_yScale = d3
                  .scaleLinear()
                  .domain([yMax, yMin])
                  .range([0, sge_yAxisLength]),
                colorscale = d3
                  .scaleSequential()
                  .domain([min_expr, max_expr])
                  // See: https://observablehq.com/@d3/working-with-color and https://github.com/d3/d3-interpolate
                  .interpolator(d3.interpolateHsl("#D3D3D3", "red"));
              function renderXAxis() {
                var xAxis = d3
                  .axisBottom()
                  .ticks(xVals.length)
                  .tickFormat(t => {
                    return xVals[t];
                  })
                  .scale(sge_xScale);
                svg
                  .append("g")
                  .attr("class", "x-axis")
                  .attr("id", "sge_x-axis")
                  .attr("transform", function() {
                    return "translate(" + sge_xMargin + "," + (sge_height - sge_bottom_yMargin) + ")";
                  })
                  .attr("opacity", 1)
                  .call(xAxis)
                  .selectAll("text")
                  .style("text-anchor", "end")
                  .attr("dx", "-.8em")
                  .attr("dy", ".15em")
                  .attr("transform", "rotate(-45)");

                d3.selectAll("#sge_x-axis g.tick")
                  .append("line")
                  .classed("grid-line", true)
                  .attr("x1", 0)
                  .attr("y1", 0)
                  .attr("x2", 0)
                  .attr("y2", -(sge_height - sge_top_yMargin - sge_bottom_yMargin))
              }

              function renderYAxis() {
                var yAxis = d3
                  .axisLeft()
                  .ticks(yVals.length)
                  .tickFormat(t => {
                    return yVals[t];
                  })
                  .scale(sge_yScale);
                svg
                  .append("g")
                  .attr("class", "y-axis")
                  .attr("id", "sge_y-axis")
                  .attr("transform", function() {
                    return "translate(" + sge_xMargin + "," + sge_top_yMargin + ")";
                  })
                  .call(yAxis);

                d3.selectAll("#sge_y-axis g.tick")
                  .append("line")
                  .classed("grid-line", true)
                  .attr("x1", 0)
                  .attr("y1", 0)
                  .attr("x2", sge_yAxisLength)
                  .attr("y2", 0)
                  .attr("fill", colorscale(0));
              }

              function renderPoint(x, y, expression, deg) {
                var innerRadius;
                // outerRadius is used for deg cell type-gene tuples only
                var outerRadius;
                if (expression > 0) {
                  if (deg) {
                    innerRadius = 5;
                    outerRadius = 8;
                  } else {
                    innerRadius = 5;
                  }
                } else {
                  innerRadius = 2;
                  outerRadius = 2;
                }

                if (deg) {
                  svg
                  .append("circle")
                    .attr("transform", function() {
                      return "translate(" + sge_xMargin + "," + sge_top_yMargin + ")";
                    })
                    .attr("cx", sge_xScale(x))
                    .attr("cy", sge_yScale(y))
                    .attr("fill", "#3DE397")
                    .attr("r", outerRadius);
                }

                var cellType = yVals[i];
                var gene = xVals[j];
                var tooltip = d3.select("#sge")
                .append("div")
                .style("position", "absolute")
                .style("visibility", "hidden")
                .style("background-color", "white")
                .style("border", "solid")
                .style("border-width", "0px")
                .style("border-radius", "5px")
                .style("padding", "10px")
                .style("box-shadow", "2px 2px 20px")
                .style("opacity", "0.9")
                .attr("id", "tooltip")
                .html(cellType + "<br>" + gene+ "<br>Expression: " + expression);

                svg
                  .append("circle")
                    .attr("id","geneexpr")
                    .attr("transform", function() {
                      return "translate(" + sge_xMargin + "," + sge_top_yMargin + ")";
                    })
                    .attr("cx", sge_xScale(x))
                    .attr("cy", sge_yScale(y))
                    .attr("fill", colorscale(expression))
                    .attr("r", innerRadius)
                    .on("mouseover", function(){tooltip.text; return tooltip.style("visibility", "visible");})
                    .on("mousemove", function(event){return tooltip.style("top", (event.pageY-10-650)+"px").style("left",(event.pageX+10-350)+"px")})
                    .on("mouseout", function(){return tooltip.style("visibility", "hidden")});
                }

              renderYAxis();
              renderXAxis();
              // cell types
              for (var i = 0; i <= yVals.length - 1; i++) {
                // genes
                for (var j = 0; j <= xVals.length - 1; j++) {
                  var expression = mean_expressions[j][i];
                  var cellType = yVals[i];
                  var gene = xVals[j];
                  deg = cellType2Degs[cellType] && cellType2Degs[cellType].includes(gene) ? true : false;
                  renderPoint(j, i, expression, deg);
                }
              }

              // Colour legend:
              // See: https://blog.scottlogic.com/2019/03/13/how-to-create-a-continuous-colour-range-legend-using-d3-and-d3fc.html
              // Band scale for x-axis
              const legend_width=50
              const legend_height=150
              const legend_xPos=sge_width-300
              const legend_yPos=sge_top_yMargin+50
              domain=[min_expr, max_expr]

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
              // Padding the domain by 10%
              // This will have an effect of the bar being 10% longer than the axis label
              // (otherwise top/bottom figures on the legend axis would be cut in half)
              const paddedDomain = fc.extentLinear()
                .pad([0.1, 0.1])
                .padUnit("percent")(domain);
              [min, max] = paddedDomain;
              const expandedDomain = d3.range(min_expr, max_expr, (max_expr - min_expr) / legend_height);

              // Define the colour legend bar
              const svgBar = fc
                .autoBandwidth(fc.seriesSvgBar())
                .xScale(legend_xScale)
                .yScale(legend_yScale)
                .crossValue(0)
                .baseValue((_, i) => (i > 0 ? expandedDomain[i - 1] : 0))
                .mainValue(d => d)
                .decorate(selection => {
                  selection.selectAll("path").style("fill", d => colorscale(d));
                });

                // Add the colour legend header
                svg
                .append("text").attr("x", legend_xPos-12).attr("y", sge_top_yMargin+10).text("Mean expression").style("font-size", "15px")
                .append('tspan').attr("x", legend_xPos-12).attr("y", sge_top_yMargin+30).text("z-score")
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

              // DEG legend:
              var deg_legend_yPos=legend_yPos+legend_height+30
              svg.append("circle").attr("cx",legend_xPos).attr("cy",deg_legend_yPos).attr("r", 8).style("fill", "#3DE397")
              svg.append("circle").attr("cx",legend_xPos).attr("cy",deg_legend_yPos).attr("r", 5).style("fill", "#FFFFFF")
              svg.append("text").attr("x", legend_xPos+20).attr("y", deg_legend_yPos).text("Is DEG gene").style("font-size", "15px").attr("alignment-baseline","middle")

            }
     });

  function store_token(val, target_div_class, input_field_id) {
    $("."+target_div_class).append($('<div class="chip">' + val + '<i class="tiny close material-icons">close</i></div>'));
    $('#' + input_field_id).val("");
  }
});

