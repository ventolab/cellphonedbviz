document.addEventListener('DOMContentLoaded', function() {
    var projectId = $("#project_id").text();

   // Populate page title
   $.ajax({
            url: '/api/list',
            contentType: "application/json",
            dataType: 'json',
            success: function(res) {
                $("#page_header").text(res[projectId]);
                $("title").text(res[projectId]);
            }
    });
    // Generate cell type composition plot
    $.ajax({
        url: '/api/data/'+projectId+'/celltype_composition',
        contentType: "application/json",
        dataType: 'json',
        success: function(res) {
          generateCellCompositionPlot(res);
        }
    });

    // Generate spatial micro-environments plot
    $.ajax({
            url: '/api/data/'+projectId+'/celltype_composition',
            contentType: "application/json",
            dataType: 'json',
            success: function(res) {
                generateMicroenvironmentsPlot(res);
            }
    });

    // Generate single gene expression plot
    $.ajax({
        url: '/api/data/'+projectId+'/single_gene_expression',
        contentType: "application/json",
        dataType: 'json',
        success: function(res) {
            sge_data = res['single_gene_expression'];
            generateSingleGeneExpressionPlot(sge_data, storeTokens=true);
            // Enable gene and cell type input autocompletes for gene expression plot
            enable_autocomplete('sge_gene_input', 'sge_selected_genes', sge_data['all_genes']);
            enable_autocomplete('sge_celltype_input', 'sge_selected_celltypes', sge_data['all_cell_types']);
            if (sge_data.hasOwnProperty('microenvironments')) {
                enable_autocomplete('sge_microenvironment_input', 'sge_selected_microenvironments', sge_data['microenvironments']);
                // Initialise 'Filter cell types by micro-environment in single gene expression plot' select dropdown
                enable_me2ct_select(sge_data['microenvironment2cell_types'], sge_data['all_cell_types'],
                                        'sge_selected_microenvironments', 'sge_selected_celltypes', 'sge_celltype_input');
            } else {
                // Hide microenviroment input
                $("#sge_microenvironment_sel").hide();
            }
        }
     });

     // Generate cell-cell interaction summary plot
    $.ajax({
        url: '/api/data/'+projectId+'/cell_cell_interaction_summary',
        contentType: "application/json",
        dataType: 'json',
        success: function(res) {
           if (res.hasOwnProperty('microenvironment2cell_types')) {
                microenvironment2cell_types = res['microenvironment2cell_types'];
                const map = new Map(Object.entries(microenvironment2cell_types));
                if (map.size > 0) {
                    var cnt = 1;
                    for (let [microenvironment, cellTypes] of map.entries()) {
                        generateCellCellInteractionPlot(res, cellTypes.sort(), microenvironment, cnt);
                        cnt++;
                        if (cnt > 4) {
                            // TODO: We currently only have up to four slots for cci plots per environment - to be reviewed
                            break;
                        }
                    }
                } else {
                    generateCellCellInteractionPlot(res, res['all_cell_types'], "", 1);
                    // Hide microenviroment input
                    $("#cci_search_microenvironment_sel").hide();
                }
            } else {
                generateCellCellInteractionPlot(res, res['all_cell_types'], "", 1);
                // Hide microenviroment input
                $("#cci_search_microenvironment_sel").hide();
            }
        }
     });

    // Generate cell-cell interaction search plot
    $.ajax({
        url: '/api/data/'+projectId+'/cell_cell_interaction_search',
        contentType: "application/json",
        dataType: 'json',
        success: function(res) {
            generateCellCellInteractionSearchPlot(res, storeTokens=true);
            // Enable gene and cell type input autocompletes for gene expression plot
            enable_autocomplete('cci_search_celltype_input', 'cci_search_selected_celltypes', res['all_cell_types']);
            enable_autocomplete('cci_search_celltype_pair_input', 'cci_search_selected_celltype_pairs', res['all_cell_type_pairs']);
            enable_autocomplete('cci_search_gene_input', 'cci_search_selected_genes', res['all_genes']);
            enable_autocomplete('cci_search_interaction_input', 'cci_search_selected_interactions', res['all_interacting_pairs']);
            if (res.hasOwnProperty('microenvironments')) {
                enable_autocomplete('cci_search_microenvironment_input', 'cci_search_selected_microenvironments', res['microenvironments']);
                // Populate 'filter cell types by micro-environment' select dropdown for single-gene expression plot
                $.each(res['microenvironments'], function (i, item) {
                  $('#cci_search_me_filter').append($('<option>', {
                      value: item,
                      text : item
                  }));
                });
                // Initialise 'Filter cell types by micro-environment in 'cell-cell interaction search' plot select dropdown
                enable_me2ct_select(res['microenvironment2cell_types'], res['all_cell_types'],
                                        'cci_search_selected_microenvironments','cci_search_selected_celltypes', 'cci_search_celltype_input');
            }
        }
     });
});

function enable_me2ct_select(microenvironment2cell_types, all_cell_types,
                             selected_microenvironments_div, selected_celltypes_div, celltype_input_div) {
    var elems = document.querySelectorAll('select');
    var options = {};
    var instances = M.FormSelect.init(elems, options);
    $('.' + selected_microenvironments_div).on('DOMSubtreeModified', function(event){
        var selected_microenvironments = $("."+selected_microenvironments_div).map((_,el) => el.innerText.replace(/(\n)*close(\n)*/g,",").replace(/,$/,"")).get()[0];
        if (selected_microenvironments) {
            var sel_mes_set = new Set();
            for (sel_me of selected_microenvironments.split(',')) {
                cts = microenvironment2cell_types[sel_me];
                sel_mes_set = new Set([ ...sel_mes_set, ...cts ]);
            }
            selected_cell_types = Array.from(sel_mes_set).sort();
            // DEBUG console.log(selected_cell_types);
            if (selected_microenvironments_div == 'sge_selected_microenvironments') {
               $('.sge_selected_celltypes').hide();
               $('#sge_celltype_input').prop( "disabled", true );
            } else if (selected_microenvironments_div == 'cci_search_selected_microenvironments') {
              // Disable cell type and cell type pair inputs as the requirement is for
              // microenvironments, cell type and cell type pair inputs to be mutually exclusive
              $('#cci_search_celltype_input').prop( "disabled", true );
              $('#cci_search_celltype_pair_input').prop( "disabled", true );
              $('.cci_search_selected_celltypes').hide();
              $('.cci_search_selected_celltype_pairs').empty();
            }
        } else {
            selected_cell_types = all_cell_types;
            if (selected_microenvironments_div == 'sge_selected_microenvironments') {
               $('.sge_selected_celltypes').show();
               $('#sge_celltype_input').prop( "disabled", false );
            } else if (selected_microenvironments_div == 'cci_search_selected_microenvironments') {
              $('#cci_search_celltype_input').prop( "disabled", false );
              $('#cci_search_celltype_pair_input').prop( "disabled", false );
              $('.cci_search_selected_celltypes').show();
            }
        }
        // Replace any previously select cell types in selected_celltypes_div with the ones in the selected microenvironments
        // We're effectively forcing the user to select either cell types or microenvironments, but not both.
        $('.'+ selected_celltypes_div).empty();
        for (var i = 0; i < selected_cell_types.length; i++) {
            storeToken(selected_cell_types[i], selected_celltypes_div, celltype_input_div);
        }
    });
}

function enable_autocomplete(input_field_id, target_div_class, vals) {
    const autocomplete_data = Object.fromEntries(vals.map(e => [e, null]));
    const options = {
        data : autocomplete_data,
        sortFunction : sortBy,
        limit: 5,
        onAutocomplete: function(val) {
            storeToken(val, target_div_class, input_field_id)
        }
    }
    var elems = document.querySelectorAll('#'+input_field_id);
    var instances = M.Autocomplete.init(elems, options);
}

// Sort function for sorting autocomplete results
function sortBy(a, b) {
  return  b > a;
}


// Collect genes and cell types selected in sge_selected_genes and sge_selected_celltypes divs respectively
function getSelectedTokens(divClassList) {
    var selectedTokens = [];
    for (let i = 0; i < divClassList.length; i++) {
        divClass = divClassList[i];
        var vals = $("."+divClass).map((_,el) => el.innerText.replace(/(\n)*close(\n)*/g,",").replace(/,$/,"")).get()[0];
        if (vals) {
            selectedTokens[i] = vals.split(",");
        }
    }
    return selectedTokens;
}

function refreshSGEPlot() {
    var projectId = $("#project_id").text();
    var ret = getSelectedTokens(["sge_selected_genes", "sge_selected_celltypes"]);
    var selectedGenes = ret[0];
    var selectedCellTypes = ret[1];
    var url = '/api/data/'+projectId+'/single_gene_expression';
    if (selectedGenes || selectedCellTypes) {
        url += "?";
        if (selectedGenes) {
            url += "genes=" + selectedGenes + "&";
        }
        if (selectedCellTypes) {
            url += "cell_types=" + selectedCellTypes + "&";
        }
    } else {
        url += "?";
    }
    // In refresh mode, we don't pre-select interactions/cell type pairs - if the user did not enter any selections
    url += "refresh_plot=True";
    $.ajax({
            url: url,
            contentType: "application/json",
            dataType: 'json',
            success: function(res) {
                sge_data = res['single_gene_expression'];
                generateSingleGeneExpressionPlot(sge_data, storeTokens=false);
            }
     });
}

function storeToken(val, target_div_class, input_field_id) {
    $("."+target_div_class).append($('<div class="chip">' + val + '<i class="tiny close material-icons">close</i></div>'));
    $('#' + input_field_id).val("");
}

function generateCellCompositionPlot(data) {
     var edges = data['edges'];
      $("#ctcomp_header").text(data['title']);
      var sankey = new Sankey('ctcomp');
      sankey.stack(0,data['list0'],data['y_space0'],data['y_box0']);
      sankey.stack(1,data['list1'],data['y_space1'],data['y_box1']);
      sankey.stack(2,data['list2'],data['y_space2'],data['y_box2']);
      sankey.stack(3,data['list3'],data['y_space3'],data['y_box3']);
      sankey.stack(4,data['list4'],data['y_space4'],data['y_box4']);
      sankey.stack(5,data['list5'],data['y_space5'],data['y_box5']);
      var elem2colour = {};
      // See: https://observablehq.com/@d3/color-schemes
      // const colours = d3.schemeTableau10.reverse();
      const colours = d3.schemePaired;
      var elems = data['all_elems'];
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
        // Switched off edge labels: return Math.round(flow);
        return "";
      };
      sankey.convert_box_value_labels_callback = function(flow) {
        // // Switched off edge labels: return (""+Math.round(flow))
        return "";
      };
      sankey.setData(edges);
      sankey.draw();
}

function generateMicroenvironmentsPlot(data) {
     var height = 450,
        width = 550,
        xMargin = 120,
        yMargin = 70,
        yVals = data['y_vals'],
        yMin = -1,
        xMin = -1,
        yMax = yVals.length - 1,
        xVals = data['x_vals'],
        xMax= xVals.length - 1,
        mapping = data['raw_data'],
        colorDomain = data['color_domain'];
      $("#spme_header").text(data['title']);

      var svg = d3
        .select("#spme")
        .append("svg")
        .attr("class", "axis")
        .attr("width", width)
        .attr("height", height);

      var yAxisLength = height - 2 * yMargin,
        xAxisLength = width - 2 * xMargin;

      var xScale = d3
          .scaleLinear()
          .domain([xMin, xMax])
          .range([0, xAxisLength]),
          yScale = d3
          .scaleLinear()
          .domain([yMax, yMin])
          .range([0, yAxisLength]),
        colorscale = d3.scaleOrdinal()
          .domain(colorDomain)
          .range(d3.schemeTableau10);

      spmeRenderYAxis(svg, yVals, yScale, xMargin, yMargin, xAxisLength, colorscale);
      spmeRenderXAxis(svg, xVals, xScale, xMargin, height, yMargin);
      for (var i = 0; i <= mapping.length - 1; i++) {
        vals = mapping[i];
        yPos = yVals.indexOf(vals[0]);
        xPos = xVals.indexOf(vals[2]);
        colorPos = colorDomain.indexOf(vals[1]);
        spmeRenderPoint(svg, xPos, yPos, colorPos, xMargin, yMargin, xScale, yScale, colorscale);
      }

      svg.selectAll("legend_dots")
        .data(colorDomain)
        .enter()
        .append("circle")
          .attr("cx", width - 100)
          .attr("cy", function(d,i){ return yMargin + i*25}) // 100 is where the first dot appears. 25 is the distance between dots
          .attr("r", 7)
          .style("fill", function(d){ return colorscale(colorDomain.indexOf(d))})

      svg.selectAll("legend_labels")
        .data(colorDomain)
        .enter()
        .append("text")
          .attr("x", width - 80)
          .attr("y", function(d,i){ return yMargin + i*25}) // 100 is where the first dot appears. 25 is the distance between dots
          .style("fill", function(d){ return colorscale(colorDomain.indexOf(d))})
          .text(function(d){ return d})
          .attr("text-anchor", "left")
          .style("alignment-baseline", "middle");
}

function spmeRenderXAxis(svg, xVals, xScale, xMargin, height, yMargin) {
    var xAxis = d3
      .axisBottom()
      .ticks(xVals.length)
      .tickFormat(t => {
        return xVals[t];
      })
      .scale(xScale);
    svg
      .append("g")
      .attr("class", "x-axis")
      .attr("id", "spme_x-axis")
      .attr("transform", function() {
        return "translate(" + xMargin + "," + (height - yMargin) + ")";
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
      .attr("y2", -(height - 2 * yMargin));
}

function spmeRenderYAxis(svg, yVals, yScale, xMargin, yMargin, xAxisLength, colorscale) {
    var yAxis = d3
      .axisLeft()
      .ticks(yVals.length)
      .tickFormat(t => {
        return yVals[t];
      })
      .scale(yScale);
    svg
      .append("g")
      .attr("class", "y-axis")
      .attr("id", "spme_y-axis")
      .attr("transform", function() {
        return "translate(" + xMargin + "," + yMargin + ")";
      })
      .call(yAxis);

    d3.selectAll("#spme_y-axis g.tick")
      .append("line")
      .classed("grid-line", true)
      .attr("x1", 0)
      .attr("y1", 0)
      .attr("x2", xAxisLength)
      .attr("y2", 0)
      .attr("fill", colorscale(0));
}

function spmeRenderPoint(svg, x, y, colorPos, xMargin, yMargin, xScale, yScale, colorscale) {
    svg
      .append("circle")
      .attr("transform", function() {
        return "translate(" + xMargin + "," + yMargin + ")";
      })
      .attr("cx", xScale(x))
      .attr("cy", yScale(y))
      .attr("fill", colorscale(colorPos))
      // .attr("r", xScale(x)/25);
      .attr("r", 7);
}

function generateSingleGeneExpressionPlot(data, storeTokens) {
    // Remove previous plot if there
    $("#sge").empty();
    var unique_genes = [];
    for (var i = 0; i < data['gene_complex'].length; i++) {
        gene = data['gene_complex'][i].split(" ")[0];
        if (!unique_genes.includes(gene)) {
            unique_genes.push(gene);
        }
    }

    if (storeTokens) {
        for (var i = 0; i < unique_genes.length; i++) {
            storeToken(unique_genes[i], "sge_selected_genes", "sge_gene_input");
        }
        for (var i = 0; i < data['cell_types'].length; i++) {
            storeToken(data['cell_types'][i], "sge_selected_celltypes", "sge_celltype_input");
        }
    }

    if (data['mean_expressions'].length == 0) {
        d3.select("#sge")
        .style("color", "purple")
        .text('No expressions were found - please try another search.');
        return
    }

    var height = 700,
    width = 900,
    bottom_yMargin = 250,
    top_yMargin = 30,
    xMargin = 120,
    yVals = data['cell_types'],
    yMin = -1,
    xMin = -1,
    yMax = yVals.length - 1,
    xVals = data['gene_complex'],
    xMax= xVals.length - 1,
    mean_expressions = data['mean_expressions'],
    // min_expr, max_expr needed for color scale
    // N.B. We don't take data['min_expression'] as min_expr because the bar legend misbehaves when min_expr > 0
    // and so far I've not been able to make it work with min_expr > 0
    min_expr = 0,
    max_expr=data['max_expression'],
    cellType2Degs = data['celltype2degs'],
    colorDomain = yVals,
    legend_offset = 160;
  var svg = d3
    .select("#sge")
    .append("svg")
    .style("color", "black")
    .attr("class", "axis")
    .attr("width", width)
    .attr("height", height);

  var yAxisLength = height - top_yMargin - bottom_yMargin,
      xAxisLength = width - xMargin - legend_offset;

  var xScale = d3
      .scaleLinear()
      .domain([xMin, xMax])
      .range([0, xAxisLength]),
      yScale = d3
      .scaleLinear()
      .domain([yMax, yMin])
      .range([0, yAxisLength]),
    colorscale = d3
      .scaleSequential()
      .domain([min_expr, max_expr])
      // See: https://observablehq.com/@d3/working-with-color and https://github.com/d3/d3-interpolate
      .interpolator(d3.interpolateHsl("#D3D3D3", "red"));


  sgeRenderYAxis(svg, yVals, yScale, xMargin, top_yMargin, xAxisLength, colorscale);
  sgeRenderXAxis(svg, xVals, xScale, xMargin, height, top_yMargin, bottom_yMargin);
  const legend_xPos=xAxisLength+legend_offset;
  const legend_yPos=top_yMargin+50;
  // cell types
  for (var i = 0; i <= yVals.length - 1; i++) {
    // genes
    for (var j = 0; j <= xVals.length - 1; j++) {
      var expression = mean_expressions[j][i];
      var cellType = yVals[i];
      var gene = xVals[j];
      deg = cellType2Degs[cellType] && cellType2Degs[cellType].includes(gene) ? true : false;
      sgeRenderPoint(svg, j, i, expression, deg, xMargin, top_yMargin, xScale, yScale, xVals, yVals, colorscale, legend_xPos, legend_yPos+320);
    }
  }

  // Colour legend:
  // See: https://blog.scottlogic.com/2019/03/13/how-to-create-a-continuous-colour-range-legend-using-d3-and-d3fc.html
  // Band scale for x-axis
  const legend_width=50
  const legend_height=150
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
  // Padding the domain by 3%
  // This will have an effect of the bar being 3% longer than the axis label
  // (otherwise top/bottom figures on the legend axis would be cut in half)
  const paddedDomain = fc.extentLinear()
    .pad([0.03, 0.03])
    .padUnit("percent")(domain);
  [min_expr, max_expr] = paddedDomain;
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
    .append("text").attr("x", legend_xPos-12).attr("y", top_yMargin+10).text("Mean expression").style("font-size", "15px")
    .append('tspan').attr("x", legend_xPos-12).attr("y", top_yMargin+30).text("z-score")
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

function sgeRenderXAxis(svg, xVals, xScale, xMargin, height, top_yMargin, bottom_yMargin) {
    var xAxis = d3
      .axisBottom()
      .ticks(xVals.length)
      .tickFormat(t => {
        return xVals[t];
      })
      .scale(xScale);
    svg
      .append("g")
      .attr("class", "x-axis")
      .attr("id", "sge_x-axis")
      .attr("transform", function() {
        return "translate(" + xMargin + "," + (height - bottom_yMargin) + ")";
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
      .attr("y2", -(height - top_yMargin - bottom_yMargin))
  }

function sgeRenderYAxis(svg, yVals, yScale, xMargin, top_yMargin, xAxisLength, colorscale) {
    var yAxis = d3
      .axisLeft()
      .ticks(yVals.length)
      .tickFormat(t => {
        return yVals[t];
      })
      .scale(yScale);
    svg
      .append("g")
      .attr("class", "y-axis")
      .attr("id", "sge_y-axis")
      .attr("transform", function() {
        return "translate(" + xMargin + "," + top_yMargin + ")";
      })
      .call(yAxis);

    d3.selectAll("#sge_y-axis g.tick")
      .append("line")
      .classed("grid-line", true)
      .attr("x1", 0)
      .attr("y1", 0)
      .attr("x2", xAxisLength)
      .attr("y2", 0)
      .attr("fill", colorscale(0));
  }

function sgeRenderPoint(svg, j, i, expression, deg, xMargin, top_yMargin, xScale, yScale, xVals, yVals, colorscale, tooltip_xPos, tooltip_yPos) {
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
          return "translate(" + xMargin + "," + top_yMargin + ")";
        })
        .attr("cx", xScale(j))
        .attr("cy", yScale(i))
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
    .attr("id", "sge_tooltip")
    .html("Cell type: " + cellType + "<br>Gene: " + gene+ "<br>Expression: " + expression);

    svg
      .append("circle")
        .attr("transform", function() {
          return "translate(" + xMargin + "," + top_yMargin + ")";
        })
        .attr("cx", xScale(j))
        .attr("cy", yScale(i))
        .attr("fill", colorscale(expression))
        .attr("r", innerRadius)
        .on("mouseover", function(){tooltip.text; return tooltip.style("visibility", "visible");})
        .on("mousemove", function(event){return tooltip.style("top", tooltip_yPos+'px').style("left",tooltip_xPos +'px')})
        .on("mouseout", function(){return tooltip.style("visibility", "hidden")});
    }

 function generateCellCellInteractionPlot(data, cellTypes, title, plotCnt) {
      var height = 600,
        width = 800,
        bottom_yMargin = 180,
        top_yMargin = 30,
        xMargin = 120,
        yVals = cellTypes,
        yMin = -1,
        xMin = -1,
        yMax = yVals.length - 1,
        xVals = cellTypes,
        xMax= xVals.length - 1,
        numInteractions = data['num_ints'],
        // total_min_ints, total_max_ints needed for color scale
        // N.B. We don't take parseInt(data['min_num_ints']) as min_ints because the bar legend misbehaves when min_ints > 0
        // and so far I've not been able to make it work with min_ints > 0
        min_ints=0,
        max_ints=parseInt(data['max_num_ints']),
        ct2indx = data['ct2indx'],
        colorDomain = yVals;

      // Filter rows and columns of numInteractions by cellTypes
      // N.B. that we don't recalculate min_ints, max_ints for filteredNumInteractions because
      // if we show one heatmap per microenvironment, we need colours comparable across all heatmaps
      var ctIndexes = cellTypes.map(ct => ct2indx[ct])
      var filteredNumInteractions = [];
      for (let i = 0; i < numInteractions.length; i++) {
          if (ctIndexes.includes(i)) {
            var filteredRow = ctIndexes.map(idx => numInteractions[i][idx]);
            filteredNumInteractions.push(filteredRow);
          }
      }
      $("#cci"+plotCnt + "_div").show();
      $("#cci"+plotCnt + "_header").text(title);

      var svg = d3
        .select("#cci" + plotCnt)
        .append("svg")
        .attr("class", "axis")
        .attr("width", width)
        .attr("height", height);

      var yAxisLength = height - top_yMargin - bottom_yMargin,
          xAxisLength = yAxisLength;

      var xScale = d3
          .scaleLinear()
          .domain([xMin, xMax])
          .range([0, xAxisLength]),
        yScale = d3
          .scaleLinear()
          .domain([yMax, yMin])
          .range([0, yAxisLength]),
        colorscale = d3
          .scaleSequential()
          .domain([max_ints, min_ints])
          // See: https://observablehq.com/@d3/sequential-scales
          .interpolator(d3.interpolateRdYlBu)

      cciRenderYAxis(svg, yVals, yScale, xMargin, top_yMargin, colorscale);
      cciRenderXAxis(svg, xVals, xScale, xMargin, height, bottom_yMargin);
      const legend_xPos=width-240
      const legend_yPos=top_yMargin+50
      // cellType1
      for (var i = 0; i <= yVals.length - 1; i++) {
        // cellType2
        for (var j = 0; j <= xVals.length - 1; j++) {
          var num_ints = filteredNumInteractions[j][i];
          var cellType1 = yVals[i];
          var cellType2 = xVals[j];
          cciRenderRectangle(svg, j, i, yVals, xMargin, top_yMargin, xVals, xScale, yScale, colorscale, num_ints, plotCnt, legend_xPos, legend_yPos+280);
        }
      }

      // Colour legend:
      // See: https://blog.scottlogic.com/2019/03/13/how-to-create-a-continuous-colour-range-legend-using-d3-and-d3fc.html
      // Band scale for x-axis
      const legend_width=50
      const legend_height=150
      domain=[min_ints, max_ints]

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
        .baseValue((_, i) => (i > 0 ? expandedDomain[i - 1] : 0))
        .mainValue(d => d)
        .decorate(selection => {
          selection.selectAll("path").style("fill", d => colorscale(d));
        });

        // Add the colour legend header
        svg
        .append("text").attr("x", legend_xPos-12).attr("y", top_yMargin+10).text("Number of").style("font-size", "15px")
        .append('tspan').attr("x", legend_xPos-12).attr("y", top_yMargin+30).text("interactions")
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
 }

function cciRenderXAxis(svg, xVals, xScale, xMargin, height, bottom_yMargin) {
  var xAxis = d3
  .axisBottom()
  .ticks(xVals.length)
  .tickFormat(t => {
    return xVals[t];
  })
  .scale(xScale);
  svg
  .append("g")
  .attr("class", "x-axis")
  .attr("transform", function() {
    return "translate(" + xMargin + "," + (height - bottom_yMargin) + ")";
  })
  .attr("opacity", 1)
  .call(xAxis)
  .selectAll("text")
  .style("text-anchor", "end")
  .attr("dx", "-1.7em")
  .attr("dy", "-0.9em")
  .attr("transform", "rotate(-45)");
}

function cciRenderYAxis(svg, yVals, yScale, xMargin, top_yMargin, colorscale) {
  var yAxis = d3
  .axisLeft()
  .ticks(yVals.length)
  .tickFormat(t => {
    return yVals[t];
  })
  .scale(yScale);
  svg
  .append("g")
  .attr("class", "y-axis")
  .attr("transform", function() {
    return "translate(" + xMargin + "," + top_yMargin + ")";
  })
  .call(yAxis)
  .selectAll("text")
  .style("text-anchor", "end")
  .attr("dx", "-0.15em")
  .attr("dy", "2.5em");
}

function cciRenderRectangle(svg, x, y, yVals, xMargin, top_yMargin, xVals, xScale, yScale, colorscale, num_ints, plotCnt, tooltip_xPos, tooltip_yPos) {
    var boxWidth = Math.round(380/yVals.length);
    // Assumption: yVals.length == xVals.length
    var boxHeight = boxWidth;
    var cellType1 = yVals[y];
    var cellType2 = xVals[x];
    var tooltip = d3.select("#cci" + plotCnt)
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
        .attr("id", "cci" + plotCnt + "_tooltip")
        .html("Number of interactions<br>between " + cellType1 + " and " + cellType2 + ": " + num_ints);

    svg.append('rect')
        .attr("transform", function() {
          return "translate(" + xMargin + "," + top_yMargin + ")";
        })
        .attr('x', xScale(x) - boxWidth)
        .attr('y', yScale(y))
        .attr('width', boxWidth)
        .attr('height', boxHeight)
        .attr("fill", colorscale(num_ints))
        .attr('stroke', 'transparent')
        .on("mouseover", function(){tooltip.text; return tooltip.style("visibility", "visible");})
        .on("mousemove", function(event){return tooltip.style("top", tooltip_yPos+'px').style("left",tooltip_xPos +'px')})
        .on("mouseout", function(){return tooltip.style("visibility", "hidden")});
}

function clearSGEFilters() {
    $('.sge_selected_genes').empty();
    $('.sge_selected_celltypes').empty();
}

function clearCCISearchFilters() {
    $('.cci_search_selected_genes').empty();
    $('.cci_search_selected_celltypes').empty();
    $('.cci_search_selected_interactions').empty();
    $('.cci_search_selected_celltype_pairs').empty();
}

function generateCellCellInteractionSearchPlot(data, storeTokens) {
    // DEBUG console.log(data);
    $("#cci_search").empty();
    const selectedGenes = data['selected_genes'];
    const selectedInteractingPairs = data['selected_interacting_pairs'];
    const selectedCellTypes = data['selected_cell_types'];
    const selectedCellTypePairs = data['selected_cell_type_pairs'];

    if (storeTokens) {
        for (var i = 0; i < selectedGenes.length; i++) {
            storeToken(selectedGenes[i], "cci_search_selected_genes", "cci_search_gene_input");
        }
        for (var i = 0; i < selectedCellTypes.length; i++) {
            storeToken(selectedCellTypes[i], "cci_search_selected_celltypes", "cci_search_celltype_input");
        }
        for (var i = 0; i < selectedInteractingPairs.length; i++) {
            storeToken(selectedInteractingPairs[i], "cci_search_selected_interactions", "cci_search_interaction_input");
        }
        for (var i = 0; i < selectedCellTypePairs.length; i++) {
            storeToken(selectedCellTypePairs[i], "cci_search_selected_celltype_pairs", "cci_search_celltype_pair_input");
        }
    }

    if (data['interacting_pairs_means'].length == 0) {
        d3.select("#cci_search")
        .style("color", "purple")
        .text('No significant interactions were found - please try another search.');
        return
    }

    // Needed for calculating the left margin
    var longest_ip_label = data['interacting_pairs_means'].sort(
        function (a, b) {
            return b.length - a.length;
        })[0];

    var height = 700,
    width = 1400,
    bottom_yMargin = 180,
    top_yMargin = 30,
    xMargin = longest_ip_label.length * 7.3,
    yVals = data['interacting_pairs_means'],
    yMin = -1,
    xMin = -1,
    yMax = yVals.length - 1,
    xVals = data['cell_type_pairs_means'],
    xMax= xVals.length - 1,
    mean_expressions = data['means'],
    // min_expr, max_expr needed for color scale
    // N.B. We don't take data['min_expression'] as min_expr because the bar legend misbehaves when min_expr > 0
    // and so far I've not been able to make it work with min_expr > 0
    min_expr = 0,
    max_expr=data['max_expression'],
    pvalues=data['filtered_pvalues'],
    colorDomain = yVals;

  var svg = d3
    .select("#cci_search")
    .style("color", "black")
    .append("svg")
    .attr("class", "axis")
    .attr("width", width)
    .attr("height", height);

  var yAxisLength = height - top_yMargin - bottom_yMargin,
      xAxisLength = width - xMargin - 350;

  var xScale = d3
      .scaleLinear()
      .domain([xMin, xMax])
      .range([0, xAxisLength]),
      yScale = d3
      .scaleLinear()
      .domain([yMax, yMin])
      .range([0, yAxisLength]),
    colorscale = d3
      .scaleSequential()
      .domain([min_expr, max_expr])
      // See: https://observablehq.com/@d3/working-with-color and https://github.com/d3/d3-interpolate
      .interpolator(d3.interpolateHsl("#D3D3D3", "red"));

  cciSearchRenderYAxis(svg, yVals, yScale, xMargin, top_yMargin, xAxisLength, colorscale);
  cciSearchRenderXAxis(svg, xVals, xScale, xMargin, height, top_yMargin, bottom_yMargin);
  const legend_xPos=width-300
  const legend_yPos=top_yMargin+50
  // interacting pairs
  for (var i = 0; i <= yVals.length - 1; i++) {
    // cell type pairs
    for (var j = 0; j <= xVals.length - 1; j++) {
      var expression = mean_expressions[i][j];
      var minusLog10PVal;
      if (pvalues) {
         minusLog10PVal = pvalues[i][j];
      }
      var cellTypePair = data['cell_type_pairs_means'][j];
      var interaction = data['interacting_pairs_means'][i];
      cciSearchRenderPoint(svg, j, i, expression, minusLog10PVal, cellTypePair, interaction, xMargin, top_yMargin, xScale, yScale, xVals, yVals, colorscale, legend_xPos-10, legend_yPos+420);
    }
  }

  // Colour legend:
  // See: https://blog.scottlogic.com/2019/03/13/how-to-create-a-continuous-colour-range-legend-using-d3-and-d3fc.html
  // Band scale for x-axis
  const legend_width=50
  const legend_height=150
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
  // Padding the domain by 3%
  // This will have an effect of the bar being 3% longer than the axis label
  // (otherwise top/bottom figures on the legend axis would be cut in half)
  const paddedDomain = fc.extentLinear()
    .pad([0.03, 0.03])
    .padUnit("percent")(domain);
  [min_expr, max_expr] = paddedDomain;
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
    .append("text").attr("x", legend_xPos-12).attr("y", top_yMargin+10).text("Mean expression").style("font-size", "15px")
    .append('tspan').attr("x", legend_xPos-12).attr("y", top_yMargin+30).text("z-score")
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

  if (pvalues) {
      // P-Value legend - dot size
      const dotlegend_xPos=width-315
      const dotlegend_yPos=top_yMargin+legend_height+10
      const dotSizeLegend = svg
            .append("svg")
            .attr("width", 450)
            .attr("height", 300)
            .attr("x", dotlegend_xPos)
            .attr("y", dotlegend_yPos);

      // Dot size legend header
      dotSizeLegend
        .append("text").attr("x", 5).attr("y", 100).text("-log").style("font-size", "15px")
        .append('tspan').text('10').style('font-size', '.7rem').attr('dx', '.1em').attr('dy', '.9em')
        .append('tspan').text("P").style("font-size", "15px").attr('dx', '-.1em').attr('dy', '-.9em')
        .attr("alignment-baseline","middle")
      // dot size legend content
      dotSizeLegend.append("circle").attr("cx",15).attr("cy",130).attr("r", 2).style("fill", "#404080")
      dotSizeLegend.append("circle").attr("cx",15).attr("cy",160).attr("r", 4).style("fill", "#404080")
      dotSizeLegend.append("circle").attr("cx",15).attr("cy",190).attr("r", 6).style("fill", "#404080")
      dotSizeLegend.append("circle").attr("cx",15).attr("cy",220).attr("r", 8).style("fill", "#404080")
      dotSizeLegend.append("text").attr("x", 35).attr("y", 130).text("0").style("font-size", "15px").attr("alignment-baseline","middle")
      dotSizeLegend.append("text").attr("x", 35).attr("y", 160).text("1").style("font-size", "15px").attr("alignment-baseline","middle")
      dotSizeLegend.append("text").attr("x", 35).attr("y", 190).text("2").style("font-size", "15px").attr("alignment-baseline","middle")
      dotSizeLegend.append("text").attr("x", 35).attr("y", 220).text(">=3").style("font-size", "15px").attr("alignment-baseline","middle")
  }
}

function cciSearchRenderXAxis(svg, xVals, xScale, xMargin, height, top_yMargin, bottom_yMargin) {
    var xAxis = d3
      .axisBottom()
      .ticks(xVals.length)
      .tickFormat(t => {
        return xVals[t];
      })
      .scale(xScale);
    svg
      .append("g")
      .attr("class", "x-axis")
      .attr("id", "cci_search_x-axis")
      .attr("transform", function() {
        return "translate(" + xMargin + "," + (height - bottom_yMargin) + ")";
      })
      .attr("opacity", 1)
      .call(xAxis)
      .selectAll("text")
      .style("text-anchor", "end")
      .attr("dx", "-.8em")
      .attr("dy", ".15em")
      .attr("transform", "rotate(-45)");

    d3.selectAll("#cci_search_x-axis g.tick")
      .append("line")
      .classed("grid-line", true)
      .attr("x1", 0)
      .attr("y1", 0)
      .attr("x2", 0)
      .attr("y2", -(height - top_yMargin - bottom_yMargin))
}

function cciSearchRenderYAxis(svg, yVals, yScale, xMargin, top_yMargin, xAxisLength, colorscale) {
    var yAxis = d3
      .axisLeft()
      .ticks(yVals.length)
      .tickFormat(t => {
        return yVals[t];
      })
      .scale(yScale);
    svg
      .append("g")
      .attr("class", "y-axis")
      .attr("id", "cci_search_y-axis")
      .attr("transform", function() {
        return "translate(" + xMargin + "," + top_yMargin + ")";
      })
      .call(yAxis);

    d3.selectAll("#cci_search_y-axis g.tick")
      .append("line")
      .classed("grid-line", true)
      .attr("x1", 0)
      .attr("y1", 0)
      .attr("x2", xAxisLength)
      .attr("y2", 0)
      .attr("fill", colorscale(0));
}

function cciSearchRenderPoint(svg, j, i, expression, minusLog10PVal, cellTypePair, interaction, xMargin, top_yMargin, xScale, yScale, xVals, yVals, colorscale, tooltip_xPos, tooltip_yPos) {

    var radius = 5;
    if (minusLog10PVal) {
        radius = minusLog10PVal * 2 + 2;
    }

    var cellType = yVals[i];
    var gene = xVals[j];
    var tooltip = d3.select("#cci_search")
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
    .attr("id", "cci_search_tooltip")
    .html("Interaction: " + interaction + "<br>Cell type pair: " + cellTypePair + "<br>Expression: " + expression + "<br>Rounded -log10pvalue: " + minusLog10PVal);

    svg
      .append("circle")
        .attr("transform", function() {
          return "translate(" + xMargin + "," + top_yMargin + ")";
        })
        .attr("cx", xScale(j))
        .attr("cy", yScale(i))
        .attr("fill", colorscale(expression))
        .attr("r", radius)
        .on("mouseover", function(){tooltip.text; return tooltip.style("visibility", "visible");})
        .on("mousemove", function(event){return tooltip.style("top", tooltip_yPos+'px').style("left",tooltip_xPos +'px')})
        .on("mouseout", function(){return tooltip.style("visibility", "hidden")});
}

function refreshCCISearchPlot() {
    var projectId = $("#project_id").text();
    var ret = getSelectedTokens([
        "cci_search_selected_genes", "cci_search_selected_celltypes",
        "cci_search_selected_celltype_pairs", "cci_search_selected_interactions"]);
    var selectedGenes = ret[0];
    var selectedCellTypes = ret[1];
    var selectedCellTypePairs = ret[2];
    var selectedInteractions = ret[3];
    // DEBUG console.log(selectedGenes, selectedCellTypes, selectedCellTypePairs, selectedInteractions);
    var url = '/api/data/'+projectId+'/cell_cell_interaction_search';
    if (selectedGenes || selectedCellTypes || selectedInteractions || selectedCellTypePairs) {
        url += "?";
        if (selectedGenes) {
            url += "genes=" + selectedGenes + "&";
        }
        if (selectedInteractions) {
            url += "interacting_pairs=" + selectedInteractions + "&";
        }
        if (selectedCellTypes) {
            url += "cell_types=" + selectedCellTypes + "&";
        }
        if (selectedCellTypePairs) {
            url += "cell_type_pairs=" + selectedCellTypePairs + "&";
        }
    } else {
        url += "?";
    }
    // In refresh mode, we don't pre-select interactions/cell type pairs - if the user did not enter any selections
    url += "refresh_plot=True";
    $.ajax({
            url: url,
            contentType: "application/json",
            dataType: 'json',
            success: function(res) {
                generateCellCellInteractionSearchPlot(res, storeTokens=false);
            }
     });
}