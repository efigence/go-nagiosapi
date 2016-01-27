(function(){
  //UI configuration
  var itemSize = 18,
      cellSize = itemSize-1,
      offset = 100,
    width = 1800,
    height = 800,
      margin = {top:20,right:20,bottom:20,left:25};

    var topHosts = Math.abs(height/itemSize)-2;

  //formats
  var hourFormat = d3.time.format('%H'),
    dayFormat = d3.time.format('%j'),
    timeFormat = d3.time.format('%Y-%m-%dT%X'),
    monthDayFormat = d3.time.format('%m.%d');

  //data vars for rendering
  var dateExtent = null,
    data = null,
    dayOffset = 0,
    colorCalibration = ['#f6faaa','#FEE08B','#FDAE61','#F46D43','#D53E4F','#9E0142'],
    dailyValueExtent = {};
    var scaleOkMax = 30*86400*1000;
    var scaleOk =  d3.scale.linear()
            .domain([900*1000, 1*86400*1000,7*86400*1000,scaleOkMax + 1])
            .range(["#00ff00","#11aa11","#117711","#005500","#004400"]);
    var scaleWarningMax = 30*86400*1000;
    var scaleWarning =  d3.scale.linear()
            .domain([900*1000, 1*86400*1000,7*86400*1000,scaleWarningMax + 1])
            .range(["#ffdd00","#ddaa00","#aa6600","#996600","#996600"]);
    var scaleCriticalMax = 30*86400*1000;
    var scaleCritical =  d3.scale.linear()
            .domain([900*1000, 1*86400*1000,7*86400*1000,scaleCriticalMax + 1])
            .range(["#ff0000","#aa0000","#770000","#660000","#660000"]);

    var scaleUnknownMax = 30*86400*1000;
    var scaleUnknown =  d3.scale.linear()
            .domain([900*1000, scaleUnknownMax + 1])
            .range(["#00cccc","#00aaaa"]);

  //axises and scales
  var axisWidth = 0 ,
    axisHeight = itemSize*24,
    xAxisScale = d3.time.scale(),
    xAxis = d3.svg.axis()
      .orient('top')
      .ticks(d3.time.days,3)
      .tickFormat(monthDayFormat),
    yAxisScale = d3.scale.linear()
      .range([0,axisHeight])
      .domain([0,24]),
    yAxis = d3.svg.axis()
      .orient('left')
      .ticks(5)
      .tickFormat(d3.format('02d'))
          .scale(yAxisScale);
    var svg = d3.select('[role="heatmap"]');
    var heatmap = svg
            .attr('width',width)
            .attr('height',height)
            .append('g')
            .attr('width',width-margin.left-margin.right)
            .attr('height',height-margin.top-margin.bottom)
            .attr('transform','translate('+margin.left+','+margin.top+')');
    var rect = null;
    //  svg.append('g')
    //   .attr('transform','translate('+margin.left+','+margin.top+')')
    //   .attr('class','x axis')
    //   .call(xAxis)
    // .append('text')
    //   .text('date')
    //   .attr('transform','translate('+axisWidth+',-10)');

    // svg.append('g')
    //   .attr('transform','translate('+margin.left+','+margin.top+')')
    //   .attr('class','y axis')
    //   .call(yAxis)
    // .append('text')
    //   .text('time')
    //     .attr('transform','translate(-10,'+axisHeight+') rotate(-90)');
    // initCalibration();
    loadData('/v1/all');
    setInterval(function() { loadData('v1/all') },3000);
  //  setTimeout(loadData('nagios.json'),6000);
    //setTimeout(loadData('nagios2.json'),9000);

    // Define the div for the tooltip
    var div = d3.select("body").append("div")
        .attr("class", "tooltip")
            .style("opacity", 0);
    function loadData(dataPath) {
    d3.json(dataPath, function (err, dataRaw) {
        data = d3.entries(dataRaw.service)

        hosts_having_service = {};
        service_host = {};
        service_count = {};
        failed_service_per_host = {};
        failed_service_count = {};
        host_service_count = {};
        services = [];
        //console.log("data:" + dataRaw);
        // first, extract statistic data from all services so we can have consitent sorting
        data.forEach(function (record,loop) {
            host = record.key;
            host_services = d3.entries(record.value);
            failed_service_per_host[host] = 0
            host_service_count[host] = 0
            host_services.forEach(function (service) {
                serviceName = service.key;
                serviceStatus = service.value;
                if (typeof hosts_having_service[host]  === "undefined") {
                    hosts_having_service[host] = {};
                }
                if (typeof service_host[serviceName]  === "undefined") {
                    service_host[serviceName] = [];
                }
                hosts_having_service[host][serviceName] = serviceStatus.state;
                service_host[serviceName].push(host);
                service_count[serviceName] = 1 + service_count[serviceName] || 0;
                failed_service_count[serviceName] = 0 + failed_service_count[serviceName] || 0;
                host_service_count[host] = 1 + host_service_count[host] || 0;
                if (serviceStatus.state != "OK") {
                    failed_service_per_host[host] = 1 + failed_service_per_host[host] || 0;
                    failed_service_count[serviceName] = 1 + failed_service_count[serviceName] || 0;
                }

            });
        });

        // extract list of services
        for (var key in service_count) {
            if (service_count.hasOwnProperty(key)) {
                services.push(key);
            }
        }
        // order them from highest count to lowest
//        console.log(JSON.stringify(services,null,2));

        services = services.sort(
            function(a, b){
                return service_count[b] - service_count[a];

            });
        //console.log(JSON.stringify(services,null,2));
        // finally tranlate that into column id
        services_column = {};
        services.forEach(function(a,i) {
            services_column[a]=i+1;
        });
        // console.log(JSON.stringify(failed_service_per_host,null,2));

        data = data.sort ( function(a, b) {
            //console.log("t:" + a.key + " r:" + JSON.stringify(failed_service_per_host[a.key],null,2));
            diff = failed_service_per_host[b.key] - failed_service_per_host[a.key];
            if (diff != 0) {
                return diff;
            } else {
                return host_service_count[b.key] - host_service_count[a.key];
            }
        })
        all_services = [];
        host_labels = [];
//        console.log(" r:" + JSON.stringify(failed_service_count,null,2));
        data.forEach(function (record,loop) {
            hostname = record.key;
            services = record.value;
            host_services = d3.entries(record.value);
            host_service_list = [];
//
            for (var key in services) {
                if (services.hasOwnProperty(key)) {
                    host_service_list.push(key);
                }
            }
            host_service_list = host_service_list.sort(
                function(a, b){
                    // x = (failed_service_count[a] * 40) + service_count[a];
                    // y = (failed_service_count[b] * 40) + service_count[b];

                    // x = (failed_service_count[a]) + service_count[a];
                    // y = (failed_service_count[b]) + service_count[b];

                    x = service_count[a];
                    y = service_count[b];
                    if (x == y) {
                        x = (failed_service_count[a]) + service_count[a];
                        y = (failed_service_count[b]) + service_count[b];
                        if (x == y) {
                            if (a>b) return 1;
                            else if (a<b) return -1;
                            else return 0;
                        } else {
                            return y - x;
                        }
                    } else {
                        return y - x;
                    }
            });
            re_services = {};
            host_service_list.forEach(function(svcName,i) {
                re_services[svcName]=i;
                obj = {};
                obj.x = i * itemSize + offset;
                obj.y = loop * itemSize;
                obj.host = record.key;
                obj.service=svcName;
                obj.svc = services[svcName];
                obj.fill = "#000000";
                obj.fill = getColorForService(services[svcName]);
                if (loop < topHosts) {
                    all_services.push(obj);
                }
            });
            h = {};
            h.x = 0;
            h.y = loop * itemSize;
            h.text = hostname;
            if (loop < topHosts) {
                host_labels.push(h);
            }

            //            console.log("loop: " + loop + " Host:" + hostname + " services:" + JSON.stringify(host_service_list,null,2));
            //            heatmap.selectAll("").remove();
        });
        heatmap.selectAll('*').remove();
        heatmap.selectAll('.heatmap').data(host_labels).enter().append('rect')
            .attr('width', offset - 2)
            .attr('height',cellSize)
            .attr('x', function(d) {
                return d.x
            })
            .attr('y',function(d) {
                return d.y;
            })
            .attr("fill", "#22aa22")
            .on("mouseover", function(d,i) {
                div.transition()
                    .duration(200)
                    .style("opacity", .9);
                div.html("<br>Data:<pre>" +  JSON.stringify(d,null,2) + "</pre>"
                        )
                    .style("left", (d3.event.pageX) + "px")
                    .style("top", (d3.event.pageY - 28) + "px")
                    .style("background","#339933")
            })
            .on("mouseout", function(d) {
                div.transition()
                    .duration(500)
                    .style("opacity", 0);
            });
        heatmap.selectAll('.heatmap').data(host_labels).enter().append('text')
            .attr("color","#FF0000")
            .attr('x', function(d) {
                return d.x + 2
            })

            .attr('y',function(d) {
                return d.y + (cellSize/1.4);
            })
            .attr("font-size",12)
            .attr("font-family","monospace")
            .text(function(d) {
                return d.text
            })
        heatmap.selectAll('.heatmap').data(all_services).enter().append('rect')
            .attr('width',cellSize)
            .attr('height',cellSize)
            .attr('x', function(d,i){
                //console.log(" host: " +record.key + " column: " + services_column[ d.key ] + " row: " + aa + "\n" );
                return d.x;
            })
            .attr('y',function(d) {
                return d.y;
            })
            .attr('fill',function(d,i) {
                return d.fill;
            })
            .on("mouseover", function(d,i) {
                div.transition()
                    .duration(200)
                    .style("opacity", .9);
                div.html(function() {
                    ts1 = new Date (d.svc["last_state_change"])
                    ts2 = new Date().getTime();
                    interval = new Date(ts2-ts1);
                    var intervalStr = '';
                    intervalStr += interval.getUTCDate()-1 + "d ";
                    intervalStr += interval.getUTCHours() + "h ";
                    intervalStr += interval.getUTCMinutes() + "m ";
                    intervalStr += interval.getUTCSeconds() + "s ";
                    return "<b>host:</b>" + d.host
                        + "<br><b>Service:</b>" + d.service
                        + "<br><b>Status:</b>" + d.svc['state']
                        + "<br><b>Message:</b>" + d.svc['check_message']
                        + "<br><b>Last change:</b>" + intervalStr
                        + "<br>Data:<pre>" +  JSON.stringify(d.svc,null,2) + "</pre>";
                })
                    .style("left", (d3.event.pageX) + "px")
                    .style("top", (d3.event.pageY - 28) + "px")
                    .style("background","#339933")
            })
            .on("mouseout", function(d) {
                div.transition()
                    .duration(500)
                    .style("opacity", 0);
            });
//        heatmap.selectAll('*').remove();



//        document.write("<pre> host: " + JSON.stringify(host_labels,null,2));
    });
//      .attr('width',cellSize)
//        .attr('height',cellSize).attr('x',3).attr('y',4).fill("#aa0000");
    };
    function initCalibration(){
        d3.select('[role="calibration"] [role="example"]').select('svg')
            .selectAll('rect').data(colorCalibration).enter()
            .append('rect')
            .attr('width',cellSize)
            .attr('height',cellSize)
            .attr('x',function(d,i){
                return i*itemSize;
            })
            .attr('fill',function(d){
                return d;
            });

        //bind click event
        d3.selectAll('[role="calibration"] [name="displayType"]').on('click',function(){
            renderColor();
        });
    }
    function getColorForService(svc) {
        ts1 = new Date (svc["last_state_change"])
        ts2 = new Date().getTime();
        interval = new Date(ts2-ts1);
        if (svc.state == "OK") {
            if (svc.downtime) {
                return "#446644"
            }
            else if (svc.flapping) {
                return "#6600aa";
            }
            else {
                return scaleOk(Math.min(interval,scaleOkMax))
            }
        } else if (svc.state == "WARNING") {
            if (svc.downtime) {
                return "#666600"
            }
            else if (svc.ack) {
                return "#555533"
            }

            else {
                return scaleWarning(Math.min(interval,scaleWarningMax))
            }
        } else if (svc.state == "CRITICAL") {
            if (svc.downtime) {
                return "#553333"
            }
            else if (svc.ack) {
                return "#444444"
            }
            else {
                return scaleCritical(Math.min(interval,scaleCriticalMax))
            }
        } else {
            if (svc.downtime) {
                return "#335555"
            }
            else if (svc.ack) {
                return "#335555"
            }
            else {
                return scaleUnknown(Math.min(interval,scaleUnknownMax))
            }
        }

    }
})();
