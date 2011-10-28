jQuery.extend( KhanUtil, {

	dragging: false,

	// Wrap graphInit to create a fixed-size graph automatically scaled to the given range
	initAutoscaledGraph: function( range, options ) {
		var graph = KhanUtil.currentGraph;
		options = jQuery.extend({
			xpixels: 500,
			ypixels: 500,
			xdivisions: 20,
			ydivisions: 20,
			labels: true,
			unityLabels: true,
			range: (typeof range === "undefined" ? [ [-10, 10], [-10, 10] ] : range),
		}, options);

		options.scale = [ options.xpixels/(options.range[0][1] - options.range[0][0]),
		                  options.ypixels/(options.range[1][1] - options.range[1][0]) ];
		options.gridStep = [ (options.range[0][1] - options.range[0][0])/options.xdivisions,
		                     (options.range[1][1] - options.range[1][0])/options.ydivisions ];

		// Attach the resulting metrics to the graph for later reference
		graph.xpixels = options.xpixels;
		graph.ypixels = options.ypixels;
		graph.range = options.range;
		graph.scale = options.scale;

		graph.graphInit(options);
	},

	// graphie puts text spans on top of the SVG, which looks good, but gets
	// in the way of mouse events. This adds another SVG element on top
	// of everything else where we can add invisible shapes with mouse
	// handlers wherever we want.
	addMouseLayer: function() {
		var graph = KhanUtil.currentGraph;

		// Attach various metrics that are used by the interactive functions.
		// TODO: Add appropriate helper functions in graphie and replace a lot of
		// the cryptic references to scale, range, xpixels, ypixels, etc.
		graph.xpixels = graph.raphael.canvas.offsetWidth;
		graph.ypixels = graph.raphael.canvas.offsetHeight;
		if (typeof graph.xpixels === "undefined") {
			graph.xpixels = graph.raphael.width;
			graph.ypixels = graph.raphael.height;
		}
		graph.scale = [ graph.scalePoint([ 1, 1 ])[0] - graph.scalePoint([ 0, 0 ])[0], graph.scalePoint([ 0, 0 ])[1] - graph.scalePoint([ 1, 1 ])[1] ];
		xmin = 0 - (graph.scalePoint([0, 0])[0] / graph.scale[0]);
		xmax = (graph.xpixels / graph.scale[0]) + xmin;
		ymin = 0 - (graph.scalePoint([0, 0])[1] / graph.scale[1]);
		ymax = (graph.ypixels / graph.scale[1]) + ymin;
		graph.range = [ [ xmin, xmax ], [ ymin, ymax ] ];

		graph.mouselayer = Raphael( graph.raphael.canvas.parentNode.id, graph.xpixels, graph.ypixels );
		jQuery( graph.mouselayer.canvas ).css( "z-index", 1 );
		Khan.scratchpad.disable();
	},


	// Find the angle between two or three points
	findAngle: function ( point1, point2, vertex ) {
		if ( typeof vertex === "undefined" ) {
			var x = point1[0] - point2[0];
			var y = point1[1] - point2[1];
			if ( !x && !y ) {
				return 0;
			}
			return ( 180 + Math.atan2( -y, -x ) * 180 / Math.PI + 360) % 360;
		} else {
			return KhanUtil.findAngle( point1, vertex ) - KhanUtil.findAngle( point2, vertex );
		}
	},

	// Draw angle arcs
	drawArcs: function( point1, vertex, point3, numArcs ) {
		var startAngle = KhanUtil.findAngle( point1, vertex);
		var endAngle = KhanUtil.findAngle( point3, vertex);
		if (( (endAngle - startAngle) % 360 + 360) % 360 > 180) {
			var temp = startAngle;
			startAngle = endAngle;
			endAngle = temp;
		}

		var radius = 0.3;
		// smaller angles need a bigger radius
		if ((((endAngle - startAngle) % 360 + 360) % 360) < 90) {
			radius = (-0.6/90) * (((endAngle - startAngle) % 360 + 360) % 360) + 0.8;
		}

		var arcset = [];
		for (var arc = 0; arc < numArcs; ++arc) {
			arcset.push( KhanUtil.currentGraph.arc( vertex, radius + (0.15 * arc), startAngle, endAngle ) );
		}
		return arcset;
	},


	// Add a point to the graph that can be dragged around.
	//
	// Options can be set to control how the point behaves:
	//   coordX, coordY:
	//     The initial position of the point
	//   snapX, snapY:
	//     The minimum increment the point can be moved
	//   constrainX, constrainY:
	//     Boolean indicating whether the point should be confined to traveling
	//     in a vertical or horizontal line, respectively
	//
	// The return value is an object that can be used to manipulate the point:
	//   The coordX and coordY properties tell you the current position
	//
	//   By adding an onMove() method to the returned object, you can install an
	//   event handler that gets called every time the user moves the point.
	//
	//   The returned object also provides a moveTo(x,y) method that will move
	//   the point to a specific coordinate
	//
	addMovablePoint: function( options ) {
		options = jQuery.extend({
			graph: KhanUtil.currentGraph,
			coordX: 0,
			coordY: 0,
			snapX: 0,
			snapY: 0,
			constrainX: false,
			constrainY: false
		}, options);
		var graph = options.graph;

		// The state object that gets returned
		var movablePoint = {
			highlight: false,
			dragging: false,
			coordX: options.coordX,
			coordY: options.coordY,
		};

		graph.style({
			fill: KhanUtil.ORANGE,
			stroke: KhanUtil.ORANGE,
		}, function() {
			movablePoint.visibleShape = graph.ellipse( [ options.coordX, options.coordY ], [ 4 / graph.scale[0], 4 / graph.scale[1] ] );
		});

		// the invisible shape in front of the point that gets mouse events
		movablePoint.mouseTarget = graph.mouselayer.circle(
				(options.coordX - graph.range[0][0]) * graph.scale[0],
				(graph.range[1][1] - options.coordY) * graph.scale[1], 15 );
		movablePoint.mouseTarget.attr({fill: "#000", "opacity": 0.0});

		jQuery( movablePoint.mouseTarget[0] ).css( "cursor", "move" );
		jQuery( movablePoint.mouseTarget[0] ).bind("vmousedown vmouseover vmouseout", function( event ) {
			if ( event.type === "vmouseover" ) {
				movablePoint.highlight = true;
				if ( !KhanUtil.dragging ) {
					movablePoint.visibleShape.animate({ scale: 2 }, 50 );
				}

			} else if ( event.type === "vmouseout" ) {
				movablePoint.highlight = false;
				if ( !movablePoint.dragging ) {
					movablePoint.visibleShape.animate({ scale: 1 }, 50 );
				}

			} else if ( event.type === "vmousedown" && (event.which === 1 || event.which === 0) ) {
				event.preventDefault();

				jQuery( document ).bind("vmousemove vmouseup", function( event ) {
					event.preventDefault();
					movablePoint.dragging = true;
					KhanUtil.dragging = true;

					// mouse{X|Y} are in pixels relative to the SVG
					var mouseX = event.pageX - jQuery( graph.raphael.canvas.parentNode ).offset().left;
					var mouseY = event.pageY - jQuery( graph.raphael.canvas.parentNode ).offset().top;
					// can't go beyond 10 pixels from the edge
					mouseX = Math.max(10, Math.min(graph.xpixels-10, mouseX));
					mouseY = Math.max(10, Math.min(graph.ypixels-10, mouseY));
					// snap to grid
					if (options.snapX) {
						mouseX = Math.round(mouseX / (graph.scale[0] * options.snapX)) * (graph.scale[0] * options.snapX);
					}
					if (options.snapY) {
						mouseY = Math.round(mouseY / (graph.scale[1] * options.snapY)) * (graph.scale[1] * options.snapY);
					}
					// constrain to vertical movement
					if (options.constrainX) {
						mouseX = (options.coordX - graph.range[0][0]) * graph.scale[0];
					}
					// constrain to horizontal movement
					if (options.constrainY) {
						mouseY = (graph.range[1][1] - options.coordY) * graph.scale[1];
					}
					// coord{X|Y} are the scaled coordinate values
					var coordX = mouseX / graph.scale[0] + graph.range[0][0];
					var coordY = graph.range[1][1] - mouseY / graph.scale[1];

					if ( event.type === "vmousemove" ) {
						var doMove = true;
						// The caller has the option of adding an onMove() method to the
						// movablePoint object we return as a sort of event handler
						// By returning false from onMove(), the move can be vetoed,
						// providing custom constraints on where the point can be moved.
						// By returning array [x, y], the move can be overridden
						if (typeof movablePoint.onMove === "function") {
							var result = movablePoint.onMove( coordX, coordY );
							if (result === false) {
								doMove = false;
							}
							if (typeof result === "object") {
								coordX = result[0];
								coordY = result[1];
								mouseX = (coordX - graph.range[0][0]) * graph.scale[0];
								mouseY = (-coordY + graph.range[1][1]) * graph.scale[1];
							}
						}
						if (doMove) {
							movablePoint.visibleShape.attr( "cx", mouseX );
							movablePoint.mouseTarget.attr( "cx", mouseX );
							movablePoint.visibleShape.attr( "cy", mouseY );
							movablePoint.mouseTarget.attr( "cy", mouseY );
							movablePoint.coordX = coordX;
							movablePoint.coordY = coordY;
						}


					} else if ( event.type === "vmouseup" ) {
						jQuery( document ).unbind( "vmousemove vmouseup" );
						movablePoint.dragging = false;
						KhanUtil.dragging = false;
						if (typeof movablePoint.onMoveEnd === "function") {
							var result = movablePoint.onMoveEnd( coordX, coordY );
							if (typeof result === "object") {
								coordX = result[0];
								coordY = result[1];
								mouseX = (coordX - graph.range[0][0]) * graph.scale[0];
								mouseY = (-coordY + graph.range[1][1]) * graph.scale[1];
								movablePoint.visibleShape.attr( "cx", mouseX );
								movablePoint.mouseTarget.attr( "cx", mouseX );
								movablePoint.visibleShape.attr( "cy", mouseY );
								movablePoint.mouseTarget.attr( "cy", mouseY );
								movablePoint.coordX = coordX;
								movablePoint.coordY = coordY;
							}
						}
						//if (!movablePoint.highlight) {
							movablePoint.visibleShape.animate({ scale: 1 }, 50 );
						//}
					}
				});
			}
		});

		// Method to let the caller animate the point to a new position. Useful
		// as part of a hint to show the user the correct place to put the point.
		movablePoint.moveTo = function( coordX, coordY ) {
			// find distance in pixels to move
			var distance = Math.sqrt((this.coordX - coordX) * graph.scale[0] * (this.coordX - coordX) * graph.scale[0]
			+ (this.coordY - coordY) * graph.scale[1] * (this.coordY - coordY) * graph.scale[1]);

			// 5ms per pixel seems good
			var time = distance * 5;

			this.visibleShape.animate({ cx: (coordX - graph.range[0][0]) * graph.scale[0] }, time );
			this.mouseTarget.animate({ cx: (coordX - graph.range[0][0]) * graph.scale[0] }, time );
			this.visibleShape.animate({ cy: (graph.range[1][1] - coordY) * graph.scale[1] }, time );
			this.mouseTarget.animate({ cy: (graph.range[1][1] - coordY) * graph.scale[1] }, time );
			this.coordX = coordX;
			this.coordY = coordY;
			if (typeof this.onMove === "function") {
				this.onMove( coordX, coordY );
			}
		};

		// Put the point at a new position without animating or calling callback
		movablePoint.setCoord = function( coordX, coordY ) {
			var scaledPoint = graph.scalePoint([ coordX, coordY ]);
			this.visibleShape.attr({ cx: scaledPoint[0] });
			this.visibleShape.attr({ cy: scaledPoint[1] });
			this.mouseTarget.attr({ cx: scaledPoint[0] });
			this.mouseTarget.attr({ cy: scaledPoint[1] });
			this.coordX = coordX;
			this.coordY = coordY;
		};


		return movablePoint;
	},


	// Add a horizontal or vertical line to the graph that can be dragged around.
	//
	// Options can be set to control how the point behaves:
	//   vertical:
	//     Boolean indicating whether the line is horizontal or vertical.
	//   coord:
	//     The initial location of the line (x or y value)
	//   snap:
	//     The minimum increment the line can be moved
	//
	// The return value is an object that can be used to manipulate the line:
	//   The coord property tells you the current position
	//
	//   By adding an onMove() method to the returned object, you can install an
	//   event handler that gets called every time the user moves the line.
	//
	//   The returned object also provides a moveTo(coord) method that will move
	//   the line to a specific location
	//
	addMovableLine: function( options ) {
		options = jQuery.extend({
			graph: KhanUtil.currentGraph,
			coord: 0,
			snap: 0,
			vertical: false,
		}, options);
		var graph = options.graph;
		var movableLine = {
				highlight: false,
				dragging: false,
				coord: options.coord
		};

		graph.style({
			fill: KhanUtil.ORANGE,
			stroke: KhanUtil.ORANGE,
		}, function() {
			if (!options.vertical) {
				movableLine.visibleShape = graph.line( [ graph.range[0][0], 0 ], [ graph.range[0][1], 0 ] );
				movableLine.visibleShape.translate( 0, -options.coord * graph.scale[0] );
			} else {
				movableLine.visibleShape = graph.line( [ 0, graph.range[1][0] ], [ 0, graph.range[1][1] ] );
				movableLine.visibleShape.translate( options.coord * graph.scale[1], 0 );
			}
		});

		// the invisible rectangle in front of the line that gets mouse events
		if (!options.vertical) {
			movableLine.mouseTarget = graph.mouselayer.rect(0, -(graph.range[0][0] + options.coord) * graph.scale[0] - 10, graph.xpixels, 20);
		} else {
			movableLine.mouseTarget = graph.mouselayer.rect((graph.range[1][1] + options.coord) * graph.scale[1] - 10, 0, 20, graph.ypixels);
		}
		movableLine.mouseTarget.attr({fill: "#000", "opacity": 0.0});

		jQuery( movableLine.mouseTarget[0] ).css( "cursor", "move" );
		jQuery( movableLine.mouseTarget[0] ).bind("vmousedown vmouseover vmouseout", function( event ) {
			if ( event.type === "vmouseover" ) {
				if ( !KhanUtil.dragging ) {
					movableLine.highlight = true;
					movableLine.visibleShape.animate({ "stroke-width": 5 }, 50 );
				}

			} else if ( event.type === "vmouseout" ) {
				movableLine.highlight = false;
				if ( !movableLine.dragging ) {
					movableLine.visibleShape.animate({ "stroke-width": 2 }, 50 );
				}

			} else if ( event.type === "vmousedown" && (event.which === 1 || event.which === 0) ) {
				event.preventDefault();

				jQuery( document ).bind("vmousemove vmouseup", function( event ) {
					event.preventDefault();
					movableLine.dragging = true;
					KhanUtil.dragging = true;

					// mouse{X|Y} are in pixels relative to the SVG
					var mouseX = event.pageX - jQuery( graph.raphael.canvas.parentNode ).offset().left;
					var mouseY = event.pageY - jQuery( graph.raphael.canvas.parentNode ).offset().top;
					// can't go beyond 10 pixels from the edge
					mouseX = Math.max(10, Math.min(graph.xpixels-10, mouseX));
					mouseY = Math.max(10, Math.min(graph.ypixels-10, mouseY));
					// snap to grid
					if (options.snap) {
						mouseX = Math.round(mouseX / (graph.scale[0] * options.snap)) * (graph.scale[0] * options.snap);
						mouseY = Math.round(mouseY / (graph.scale[1] * options.snap)) * (graph.scale[1] * options.snap);
					}
					// coord{X|Y} are the scaled coordinate values
					var coordX = mouseX / graph.scale[0] + graph.range[0][0];
					var coordY = graph.range[1][1] - mouseY / graph.scale[1];

					if ( event.type === "vmousemove" ) {
						if (options.vertical) {
							movableLine.visibleShape.translate( (coordX * graph.scale[0]) - movableLine.visibleShape.attr("translation").x, 0 );
							movableLine.mouseTarget.attr( "x", mouseX - 10 );
							movableLine.coord = coordX;

							// The caller has the option of adding an onMove() method to the
							// movablePoint object we return as a sort of event handler
							if (typeof movableLine.onMove === "function") {
								movableLine.onMove(coordX);
							}
						} else {
							movableLine.visibleShape.translate( 0, (-coordY * graph.scale[1]) - movableLine.visibleShape.attr("translation").y, 0 );
							movableLine.mouseTarget.attr( "y", mouseY - 10 );
							movableLine.coord = coordY;

							// The caller has the option of adding an onMove() method to the
							// movablePoint object we return as a sort of event handler
							if (typeof movableLine.onMove === "function") {
								movableLine.onMove(coordY);
							}
						}

					} else if ( event.type === "vmouseup" ) {
						jQuery( document ).unbind( "vmousemove vmouseup" );
						movableLine.dragging = false;
						KhanUtil.dragging = false;
						if (!movableLine.highlight) {
							movableLine.visibleShape.animate({ "stroke-width": 2 }, 50 );
						}

					}
				});
			}
		});

		// Method to let the caller animate the line to a new position. Useful
		// as part of a hint to show the user the correct place to put the line.
		movableLine.moveTo = function( coord ) {
			if (options.vertical) {
				// find distance in pixels to move
				var distance = Math.abs(this.coord - coord) * graph.scale[0];
				// 5ms per pixel seems good
				var time = distance * 5;

				this.visibleShape.animate({ translation: [ coord * graph.scale[0] - this.visibleShape.attr("translation").x, 0 ] }, time );
				this.mouseTarget.animate({ y: coord / graph.scale[0] + graph.range[0][0] - 10 }, time );

			} else {
				// find distance in pixels to move
				var distance = Math.abs(this.coord - coord) * graph.scale[1];
				// 5ms per pixel seems good
				var time = distance * 5;

				this.visibleShape.animate({ translation: [ 0, -coord * graph.scale[1] - this.visibleShape.attr("translation").y ] }, time );
				this.mouseTarget.animate({ y: (graph.range[1][1] - coord) * graph.scale[1] - 10 }, time );
			}

			this.coord = coord;
			if (typeof this.onMove === "function") {
				movableLine.onMove(coord);
			}
		};

		return movableLine;
	},


	svgPath: function( points ) {
		return jQuery.map(points, function( point, i ) {
			if ( point === true ) {
				return "z";
			}
			return ( i === 0 ? "M" : "L") + point[0] + " " + point[1];
		}).join("");
	},

	distance: function( point1, point2 ) {
		return Math.sqrt( (point1[0] - point2[0]) * (point1[0] - point2[0]) + (point1[1] - point2[1]) * (point1[1] - point2[1]) );
	},

	// Plot a function that allows the user to mouse over points on the function.
	// * currently, the function must be continuous
	//
	// The return value is an object:
	//   By adding an onMove() method to the returned object, you can install an
	//   event handler that gets called every time the user moves the mouse over
	//   the function.
	//
	//   By adding an onLeave() method to the returned object, you can install an
	//   event handler that gets called when the mouse moves away from the function.
	//
	addInteractiveFn: function( fn, options ) {
		options = jQuery.extend({
			graph: KhanUtil.currentGraph,
			snap: 0,
		}, options);
		var graph = options.graph;
		var interactiveFn = {
			highlight: false,
		};

		// Plot the function
		graph.style({
			stroke: KhanUtil.BLUE,
		}, function() {
			interactiveFn.visibleShape = graph.plot( fn, [ graph.range[0][0], graph.range[0][1] ] );
		});

		// Draw a circle that will be used to highlight the point on the function the mouse is closest to
		graph.style({
			fill: KhanUtil.BLUE,
			stroke: KhanUtil.BLUE,
		}, function() {
			interactiveFn.cursorPoint = graph.ellipse( [ 0, fn(0) ], [ 4 / graph.scale[0], 4 / graph.scale[1] ] );
		});
		// Hide the point for now
		interactiveFn.cursorPoint.attr("opacity", 0.0 );

		// We want the mouse target to be much wider than the line itself, so you don't
		// have to hit a 2px target. Ideally, this would be done with an invisible
		// line following the same path, but with a really big strokeWidth. That
		// mostly works, but unfortunately there seem to be some bugs in Firefox
		// where it gets a bit confused about whether the mouse is or isn't over
		// a really thick curved line :(
		//
		// So instead, we have to use a polygon.
		var mouseAreaWidth = 30;
		var points = [];
		var step = ( graph.range[0][1] - graph.range[0][0] ) / 100;
		// Draw a curve parallel to, but (mouseAreaWidth/2 pixels) above the function
		for ( var x = graph.range[0][0]; x <= graph.range[0][1]; x += step ) {
			var ddx = (fn(x - 0.001) - fn(x + 0.001)) / 0.002;
			var x1 = x;
			var y1 = fn(x) + (mouseAreaWidth / (2 * graph.scale[1]));

			if (ddx != 0) {
				var normalslope = (-1 / (ddx * (graph.scale[1] / graph.scale[0]))) / (graph.scale[1] / graph.scale[0]);
				if ( ddx < 0 ) {
					x1 = x - Math.cos( -Math.atan(normalslope * (graph.scale[1] / graph.scale[0]))) * mouseAreaWidth / (2 * graph.scale[0]);
					y1 = normalslope * (x - x1) + fn(x);
				} else if (ddx > 0) {
					x1 = x + Math.cos( -Math.atan(normalslope * (graph.scale[1] / graph.scale[0]))) * mouseAreaWidth / (2 * graph.scale[0]);
					y1 = normalslope * (x - x1) + fn(x);
				}
			}
			points.push( [(x1 - graph.range[0][0]) * graph.scale[0], (graph.range[1][1] - y1) * graph.scale[1] ] );
		}
		// Draw a curve parallel to, but (mouseAreaWidth/2 pixels) below the function
		for ( var x = graph.range[0][1]; x >= graph.range[0][0]; x -= step ) {
			var ddx = (fn(x - 0.001) - fn(x + 0.001)) / 0.002;
			var x1 = x;
			var y1 = fn(x) - (mouseAreaWidth / (2 * graph.scale[1]));

			if (ddx != 0) {
				var normalslope = (-1 / (ddx * (graph.scale[1] / graph.scale[0]))) / (graph.scale[1] / graph.scale[0]);
				if ( ddx < 0 ) {
					x1 = x + Math.cos( -Math.atan(normalslope * (graph.scale[1] / graph.scale[0]))) * mouseAreaWidth / (2 * graph.scale[0]);
					y1 = normalslope * (x - x1) + fn(x);
				} else if (ddx > 0) {
					x1 = x - Math.cos( -Math.atan(normalslope * (graph.scale[1] / graph.scale[0]))) * mouseAreaWidth / (2 * graph.scale[0]);
					y1 = normalslope * (x - x1) + fn(x);
				}
			}
			points.push( [(x1 - graph.range[0][0]) * graph.scale[0], (graph.range[1][1] - y1) * graph.scale[1] ] );
		}
		// plot the polygon and make it invisible
		interactiveFn.mouseTarget = graph.mouselayer.path(this.svgPath(points));
		interactiveFn.mouseTarget.attr({ fill: "#000", "opacity": 0.0 });

		// Add mouse handlers to the polygon
		jQuery( interactiveFn.mouseTarget[0] ).bind("vmouseover vmouseout vmousemove", function( event ) {
			event.preventDefault();
			var mouseX = event.pageX - jQuery( graph.raphael.canvas.parentNode ).offset().left;
			var mouseY = event.pageY - jQuery( graph.raphael.canvas.parentNode ).offset().top;
			// can't go beyond 10 pixels from the edge
			mouseX = Math.max(10, Math.min(graph.xpixels-10, mouseX));
			mouseY = Math.max(10, Math.min(graph.ypixels-10, mouseY));
			// snap to grid
			if (options.snap) {
				mouseX = Math.round(mouseX / (graph.scale[0] * options.snap)) * (graph.scale[0] * options.snap);
			}
			// coord{X|Y} are the scaled coordinate values
			var coordX = mouseX / graph.scale[0] + graph.range[0][0];
			var coordY = graph.range[1][1] - mouseY / graph.scale[1];

			// Find the closest point on the curve to the mouse (by brute force)
			var closestX = 0;
			var minDist = Math.sqrt((coordX) * (coordX) + (coordY) * (coordY));
			for (var x = graph.range[0][0]; x < graph.range[0][1]; x += ((graph.range[0][1] - graph.range[0][0])/graph.xpixels)) {
				if (Math.sqrt((x-coordX) * (x-coordX) + (fn(x) -coordY) * (fn(x)-coordY)) < minDist) {
					closestX = x;
					minDist = Math.sqrt((x-coordX) * (x-coordX) + (fn(x) -coordY) * (fn(x)-coordY));
				}
			}

			interactiveFn.cursorPoint.attr("cx", (graph.range[0][1] + closestX) * graph.scale[0]);
			interactiveFn.cursorPoint.attr("cy", (graph.range[1][1] - fn(closestX)) * graph.scale[1]);

			coordX = closestX;
			coordY = fn(closestX);

			// If the caller wants to be notified when the user points to the function
			if (typeof interactiveFn.onMove === "function") {
				interactiveFn.onMove(coordX, coordY);
			}

			if ( event.type === "vmouseover" ) {
				interactiveFn.cursorPoint.animate({ opacity: 1.0 }, 50 );
				interactiveFn.highlight = true;

			} else if ( event.type === "vmouseout" ) {
				interactiveFn.highlight = false;
				interactiveFn.cursorPoint.animate({ opacity: 0.0 }, 50 );
				// If the caller wants to be notified when the user stops pointing to the function
				if (typeof interactiveFn.onLeave === "function") {
					interactiveFn.onLeave(coordX, coordY);
				}
			}
		});

		interactiveFn.mouseTarget.toBack();
		return interactiveFn;
	},


	// Useful for shapes that are only sometimes drawn. If a shape isn't
	// needed, it can be replaced with bogusShape which just has stub methods
	// that successfully do nothing.
	// The alternative would be 'if..typeof' checks all over the place.
	bogusShape: {
		animate: function(){},
		attr: function(){},
		remove: function(){}
	},


	// A SmartPoint wraps MovablePoint and allows automatic constraints on
	// its movement as well as automatically managing line segments that
	// terminate at the point.
	//
	//  - Set point to be immovable (perhaps not too useful):
	//        smartPoint.fixed = true
	//
	//  - Constrain point to a fixed distance from another point. The resulting
	//    point will move in a circle:
	//        smartPoint.fixedDistance = {
	//           dist: 2,
	//           point: point1
	//        }
	//
	//  - Constrain point to a line defined by a fixed angle between it and
	//    two other points:
	//        smartPoint.fixedAngle = {
	//           angle: 45,
	//           vertex: point1,
	//           ref: point2
	//        }
	//
	//  - Connect a movableLineSegment to a smartPoint. The point is attached
	//    to a specific end of the line segment by adding the segment either to
	//    the list of lines that start at the point or the list of lines that
	//    end at the point:
	//        smartPoint.lineStarts.push( movableLineSegment );
	//          - or -
	//        smartPoint.lineEnds.push( movableLineSegment );
	//
	addSmartPoint: function( options ) {
		options = jQuery.extend({
			graph: KhanUtil.currentGraph,
			coordX: 0,
			coordY: 0,
			fixed: false,
			invisible: false,
			fixedAngle: {},
			fixedDistance: {}
		}, options);
		var graph = options.graph;

		var smartPoint = jQuery.extend({
			coord: [ options.coordX, options.coordY ],
			lineStarts: [],
			lineEnds: [],
		}, options);

		if (!smartPoint.invisible) {
			smartPoint.point = KhanUtil.addMovablePoint( options );
		} else {
			smartPoint.point = {
				coordX: options.coordX,
				coordY: options.coordY,
				setCoord: function( coordX, coordY ) {
					this.coordX = coordX;
					this.coordY = coordY;
				}
			};
		}

		// Using the passed coordinates, apply any constraints and return the closest coordinates
		// that match the constraints.
		smartPoint.applyConstraint = function( coord ) {
			var newCoord = [ coord[0], coord[1] ];
			if ( typeof this.fixedAngle.angle === "number" && typeof this.fixedDistance.dist === "number") {
				// both distance and angle are constrained
				var constrainedAngle = this.fixedAngle.angle + KhanUtil.findAngle( this.fixedAngle.ref.coord, this.fixedAngle.vertex.coord );
				var length = this.fixedDistance.dist;
				constrainedAngle = constrainedAngle * Math.PI / 180;
				newCoord[0] = length * Math.cos(constrainedAngle) + this.fixedDistance.point.coord[0];
				newCoord[1] = length * Math.sin(constrainedAngle) + this.fixedDistance.point.coord[1];
				// newCoord[0] = length * Math.cos(constrainedAngle) + this.fixedAngle.vertex.coord[0];
				// newCoord[1] = length * Math.sin(constrainedAngle) + this.fixedAngle.vertex.coord[1];

			} else if ( typeof this.fixedAngle.angle === "number" ) {
				// angle is constrained:
				// constrainedAngle is the angle from vertex to the point with reference to the screen
				var constrainedAngle = (this.fixedAngle.angle + KhanUtil.findAngle( this.fixedAngle.ref.coord, this.fixedAngle.vertex.coord ) ) * Math.PI / 180;
				// angle is the angle from vertex to the mouse with reference to the screen
				var angle = KhanUtil.findAngle( coord, this.fixedAngle.vertex.coord ) * Math.PI / 180;
				var distance = KhanUtil.distance( coord, this.fixedAngle.vertex.coord );
				var length = distance * Math.cos(constrainedAngle - angle);
				length = length < 0.5 ? 0.5 : length;
				newCoord[0] = length * Math.cos(constrainedAngle) + this.fixedAngle.vertex.coord[0];
				newCoord[1] = length * Math.sin(constrainedAngle) + this.fixedAngle.vertex.coord[1];

			} else if ( typeof this.fixedDistance.dist === "number" ) {
				// distance is constrained
				var angle = KhanUtil.findAngle( coord, this.fixedDistance.point.coord );
				var length = this.fixedDistance.dist;
				angle = angle * Math.PI / 180;
				newCoord[0] = length * Math.cos(angle) + this.fixedDistance.point.coord[0];
				newCoord[1] = length * Math.sin(angle) + this.fixedDistance.point.coord[1];

			} else if ( this.fixed ) {
				// point is fixed
				newCoord = this.coord;

			}
			return newCoord;
		};

		// After moving the point, call this to update all line segments terminating at the point
		smartPoint.updateLineEnds = function() {
			jQuery( this.lineStarts ).each( function() {
				this.coordA = smartPoint.coord;
				this.transform();
			});
			jQuery( this.lineEnds ).each( function() {
				this.coordZ = smartPoint.coord;
				this.transform();
			});
		};

		// Force the point to check its constraints and move itself if necessary. Useful after
		// moving other stuff upon which the point's position may depend.
		smartPoint.meetConstraints = function() {
			var coord = this.applyConstraint( this.coord );
			if ( this.coord !== coord ) {
				this.point.setCoord( coord[0], coord[1] );
				this.coord = coord;
				this.updateLineEnds();
			}
		};

		// Move the point to a specific location without any other checks or callbacks
		smartPoint.setCoord = function( coordX, coordY ) {
			this.point.setCoord( coordX, coordY );
			this.coord = [ coordX, coordY ];
		};

		// Change z-order to back
		smartPoint.toBack = function() {
			if (!this.invisible) {
				smartPoint.point.mouseTarget.toBack();
				smartPoint.point.visibleShape.toBack();
			}
		};

		// Change z-order to front
		smartPoint.toFront = function() {
			if (!this.invisible) {
				smartPoint.point.mouseTarget.toFront();
				smartPoint.point.visibleShape.toFront();
			}
		};


		smartPoint.point.onMove = function( coordX, coordY ) {
			var dX = smartPoint.coord[0];
			var dY = smartPoint.coord[1];
			smartPoint.coord = smartPoint.applyConstraint([ coordX, coordY ]);
			smartPoint.updateLineEnds();

			dX = smartPoint.coord[0] - dX;
			dY = smartPoint.coord[1] - dY;
			if ( typeof smartPoint.onMove === "function" ) {
				smartPoint.onMove( dX, dY );
			}

			smartPoint.toFront();

			return smartPoint.coord;
		};

		smartPoint.point.onMoveEnd = function( coordX, coordY ) {
			smartPoint.coord = smartPoint.applyConstraint([ coordX, coordY ]);
			if ( typeof smartPoint.onMoveEnd === "function" ) {
				return smartPoint.onMoveEnd( coordX, coordY );
			}
		};

		return smartPoint;
	},


	// MovableLineSegment is a line segment that can be dragged around the
	// screen. By attaching a smartPoint to each (or one) end, the ends can be
	// manipulated individually.
	//
	// To use with smartPoints, add the smartPoints first, then:
	//   addMovableLineSegment({ pointA: smartPoint1, pointZ: smartPoint2 });
	// Or just one end:
	//   addMovableLineSegment({ pointA: smartPoint, coordZ: [0, 0] });
	//
	// Include "fixed: true" in the options if you don't want the entire line
	// to be draggable (you can still use points to make the endpoints
	// draggable)
	//
	// The returned object includes the following properties/methods:
	//
	//   - lineSegment.coordA / lineSegment.coordZ
	//         The coordinates of each end of the line segment
	//
	//   - lineSegment.transform( syncToPoints )
	//         Repositions the line segment. Call after changing coordA and/or
	//         coordZ, or pass syncToPoints = true to use the current position
	//         of the corresponding smartPoints, if the segment was defined using
	//         smartPoints
	//
	addMovableLineSegment: function( options ) {
		options = jQuery.extend({
			graph: KhanUtil.currentGraph,
			coordA: [ 0, 0 ],
			coordZ: [ 1, 1 ],
			snap: 0,
			style: { stroke: KhanUtil.BLUE, "stroke-width": 2 },
			fixed: false,
			ticks: 0
		}, options);
		var graph = options.graph;
		var lineSegment = jQuery.extend({
			highlight: false,
			dragging: false,
			tick: []
		}, options);

		graph.style( options.style );
		for (var i = 0; i < options.ticks; ++i) {
			lineSegment.tick[i] = KhanUtil.bogusShape;
		}
		var path = KhanUtil.svgPath([ [ 0, 0 ], [ graph.scale[0], 0 ] ]);
		for (var i = 0; i < options.ticks; ++i) {
			var tickoffset = (0.5 * graph.scale[0]) - (options.ticks - 1) * 1 + (i * 2);
			path += KhanUtil.svgPath([ [ tickoffset, -7 ], [ tickoffset, 7 ] ]);
		}
		lineSegment.visibleLine = graph.raphael.path( path );
		lineSegment.visibleLine.attr( options.style );
		//lineSegment.visibleLine = graph.line( [graph.range[0][0], graph.range[1][1]], [graph.range[0][0]+1, graph.range[1][1]] );
		lineSegment.mouseTarget = graph.mouselayer.rect(
			graph.scalePoint([graph.range[0][0], graph.range[1][1]])[0],
			graph.scalePoint([graph.range[0][0], graph.range[1][1]])[1] - 10,
			graph.scaleVector([1, 1])[0], 20
		);
		lineSegment.mouseTarget.attr({fill: "#000", "opacity": 0.0});

		if ( typeof options.pointA === "object" ) {
			lineSegment.coordA = options.pointA.coord;
			options.pointA.lineStarts.push( lineSegment );
			options.pointA.point.visibleShape.toFront();
			options.pointA.point.mouseTarget.toFront();
		}
		if ( typeof options.pointZ === "object" ) {
			lineSegment.coordZ = options.pointZ.coord;
			options.pointZ.lineEnds.push( lineSegment );
			options.pointZ.point.visibleShape.toFront();
			options.pointZ.point.mouseTarget.toFront();
		}

		// Reposition the line segment. Call after changing coordA and/or
		// coordZ, or pass syncToPoints = true to use the current position of
		// the corresponding smartPoints, if the segment was defined using
		// smartPoints
		lineSegment.transform = function( syncToPoints ) {
			if ( syncToPoints ) {
				if ( typeof this.pointA === "object" ) {
					this.coordA = this.pointA.coord;
				}
				if ( typeof this.pointZ === "object" ) {
					this.coordZ = this.pointZ.coord;
				}
			}
			var angle = KhanUtil.findAngle( this.coordZ, this.coordA );
			var scaledA = graph.scalePoint( this.coordA );
			this.visibleLine.translate( scaledA[0] - this.visibleLine.attr("translation").x, scaledA[1] - this.visibleLine.attr("translation").y );
			this.visibleLine.rotate( -angle, scaledA[0], scaledA[1] );
			this.visibleLine.scale( KhanUtil.distance(this.coordA, this.coordZ), 1, scaledA[0], scaledA[1] );

			this.mouseTarget.translate( scaledA[0] - this.mouseTarget.attr("translation").x, scaledA[1] - this.mouseTarget.attr("translation").y );
			this.mouseTarget.rotate( -angle, scaledA[0], scaledA[1] );
			this.mouseTarget.scale( KhanUtil.distance(this.coordA, this.coordZ), 1, scaledA[0], scaledA[1] );
			// for (var i = 0; i < lineSegment.ticks; ++i) {
				// lineSegment.tick[i].remove();
				// graph.style({ stroke: lineSegment.color, "stroke-width": 2, opacity: 1.0 });
				// lineSegment.tick[i] = graph.line( [graph.range[0][0]+0.5, graph.range[1][1]-0.15], [graph.range[0][0]+0.5, graph.range[1][1]+0.15] );
				// lineSegment.tick[i].translate( scaledA[0] - lineSegment.tick[i].attr("translation").x, scaledA[1] - lineSegment.tick[i].attr("translation").y );
				// lineSegment.tick[i].rotate( -angle, scaledA[0], scaledA[1] );
				// lineSegment.tick[i].scale( KhanUtil.distance(this.coordA, this.coordZ), 1, scaledA[0], scaledA[1] );
			// }
		};

		// Change z-order to back
		lineSegment.toBack = function() {
			lineSegment.mouseTarget.toBack();
			lineSegment.visibleLine.toBack();
		};

		// Change z-order to front
		lineSegment.toFront = function() {
			lineSegment.mouseTarget.toFront();
			lineSegment.visibleLine.toFront();
		};

		if ( !options.fixed ) {
			jQuery( lineSegment.mouseTarget[0] ).css( "cursor", "move" );
			jQuery( lineSegment.mouseTarget[0] ).bind("vmousedown vmouseover vmouseout", function( event ) {
				if ( event.type === "vmouseover" ) {
					if ( !KhanUtil.dragging ) {
						lineSegment.highlight = true;
						lineSegment.visibleLine.animate({ "stroke-width": 5, "stroke": KhanUtil.ORANGE }, 50 );
					}

				} else if ( event.type === "vmouseout" ) {
					lineSegment.highlight = false;
					if ( !lineSegment.dragging ) {
						lineSegment.visibleLine.animate( lineSegment.style, 50 );
					}

				} else if ( event.type === "vmousedown" && (event.which === 1 || event.which === 0) ) {
					event.preventDefault();
					// coord{X|Y} are the scaled coordinate values of the mouse position
					var coordX = (event.pageX - jQuery( graph.raphael.canvas.parentNode ).offset().left) / graph.scale[0] + graph.range[0][0];
					var coordY = graph.range[1][1] - (event.pageY - jQuery( graph.raphael.canvas.parentNode ).offset().top) / graph.scale[1];
					// Offsets between the mouse and each end of the line segment
					var mouseOffsetA = [ lineSegment.coordA[0] - coordX, lineSegment.coordA[1] - coordY ];
					var mouseOffsetZ = [ lineSegment.coordZ[0] - coordX, lineSegment.coordZ[1] - coordY ];

					// Figure out how many pixels of the bounding box of the line segment lie to each direction of the mouse
					var offsetLeft = -Math.min( graph.scaleVector(mouseOffsetA)[0], graph.scaleVector(mouseOffsetZ)[0] );
					var offsetRight = Math.max( graph.scaleVector(mouseOffsetA)[0], graph.scaleVector(mouseOffsetZ)[0] );
					var offsetTop = Math.max( graph.scaleVector(mouseOffsetA)[1], graph.scaleVector(mouseOffsetZ)[1] );
					var offsetBottom = -Math.min( graph.scaleVector(mouseOffsetA)[1], graph.scaleVector(mouseOffsetZ)[1] );

					jQuery( document ).bind("vmousemove vmouseup", function( event ) {
						event.preventDefault();
						lineSegment.dragging = true;
						KhanUtil.dragging = true;

						// mouse{X|Y} are in pixels relative to the SVG
						var mouseX = event.pageX - jQuery( graph.raphael.canvas.parentNode ).offset().left;
						var mouseY = event.pageY - jQuery( graph.raphael.canvas.parentNode ).offset().top;
						// no part of the line segment can go beyond 10 pixels from the edge
						mouseX = Math.max(offsetLeft + 10, Math.min(graph.xpixels-10-offsetRight, mouseX));
						mouseY = Math.max(offsetTop + 10, Math.min(graph.ypixels-10-offsetBottom, mouseY));

						// coord{X|Y} are the scaled coordinate values
						var coordX = mouseX / graph.scale[0] + graph.range[0][0];
						var coordY = graph.range[1][1] - mouseY / graph.scale[1];
						if ( event.type === "vmousemove" ) {
							var dX = coordX + mouseOffsetA[0] - lineSegment.coordA[0];
							var dY = coordY + mouseOffsetA[1] - lineSegment.coordA[1];
							lineSegment.coordA = [coordX + mouseOffsetA[0], coordY + mouseOffsetA[1]];
							lineSegment.coordZ = [coordX + mouseOffsetZ[0], coordY + mouseOffsetZ[1]];
							lineSegment.transform();
							if (typeof lineSegment.onMove === "function") {
								lineSegment.onMove( dX, dY );
							}

						} else if ( event.type === "vmouseup" ) {
							jQuery( document ).unbind( "vmousemove vmouseup" );
							lineSegment.dragging = false;
							KhanUtil.dragging = false;
							if (!lineSegment.highlight) {
								lineSegment.visibleLine.animate(lineSegment.style, 50 );
							}
							if (typeof lineSegment.onMoveEnd === "function") {
								lineSegment.onMoveEnd();
							}

						}
					});
				}
			});
		}

		lineSegment.toBack();
		lineSegment.transform();
		return lineSegment;
	},

});
