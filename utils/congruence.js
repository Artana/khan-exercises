jQuery.extend( KhanUtil, {

	addInteractiveTriangle: function( options ) {
		var triangle = jQuery.extend({
			points: [],
			lines: [],
			numArcs: options.numArcs,
			arcs: [],
			radii: [],
			reflected: false
		}, options);
		var graph = options.graph;
		
		var coord = [ 0, 0 ];
		triangle.points.push( KhanUtil.addSmartPoint({ coordX: coord[0], coordY: coord[1] }) );

		var angles = options.angles.slice();
		
		if (!options.reflected) {
			jQuery( angles ).each( function( n ) {
				angles[n] *= -1;
			});
		}

		coord[0] += options.sides[0] * Math.cos( angles[0] * Math.PI / 180 );
		coord[1] += options.sides[0] * Math.sin( angles[0] * Math.PI / 180 );
		triangle.points.push( KhanUtil.addSmartPoint({ coordX: coord[0], coordY: coord[1] }) );
	
		coord[0] += options.sides[1] * Math.cos( -(180 - angles[1] - angles[0]) * Math.PI / 180 );
		coord[1] += options.sides[1] * Math.sin( -(180 - angles[1] - angles[0]) * Math.PI / 180 );
		triangle.points.push( KhanUtil.addSmartPoint({ coordX: coord[0], coordY: coord[1] }) );
	
		coord[0] += options.sides[2] * Math.cos( (angles[2] + angles[1] + angles[0]) * Math.PI / 180 );
		coord[1] += options.sides[2] * Math.sin( (angles[2] + angles[1] + angles[0]) * Math.PI / 180 );
		triangle.points.push( KhanUtil.addSmartPoint({ coordX: coord[0], coordY: coord[1] }) );

		triangle.lines.push( KhanUtil.addMovableLineSegment({ pointA: triangle.points[0], pointZ: triangle.points[1], ticks: options.ticks[0] }) );
		triangle.lines.push( KhanUtil.addMovableLineSegment({ pointA: triangle.points[1], pointZ: triangle.points[2], ticks: options.ticks[1] }) );
		triangle.lines.push( KhanUtil.addMovableLineSegment({ pointA: triangle.points[2], pointZ: triangle.points[3], ticks: options.ticks[2] }) );
		
		triangle.rotationPoint = KhanUtil.addSmartPoint({ invisible: true });
		
		triangle.update = function() {
			if ( !KhanUtil.dragging ) {
				var minX = Math.min(triangle.points[0].coord[0], triangle.points[1].coord[0], triangle.points[2].coord[0], triangle.points[3].coord[0]);
				var maxX = Math.max(triangle.points[0].coord[0], triangle.points[1].coord[0], triangle.points[2].coord[0], triangle.points[3].coord[0]);
				var minY = Math.min(triangle.points[0].coord[1], triangle.points[1].coord[1], triangle.points[2].coord[1], triangle.points[3].coord[1]);
				var maxY = Math.max(triangle.points[0].coord[1], triangle.points[1].coord[1], triangle.points[2].coord[1], triangle.points[3].coord[1]);
				triangle.rotationPoint.setCoord( (maxX - minX) / 2 + minX, (maxY - minY) / 2 + minY );
				
				for ( var point = 0; point < 4; ++point ) {
					triangle.radii[point] = KhanUtil.distance( triangle.points[point].coord, triangle.rotationPoint.coord );
					if ( triangle.points[point].isRotationPoint ) {
						triangle.points[point].fixedDistance = { dist: triangle.radii[point], point: triangle.rotationPoint };
					}
				}
			}
			
			graph.style({ stroke: KhanUtil.BLUE, opacity: 1.0, "stroke-width": 2 });
			for ( var angle = 0; angle < 2; ++angle ) {				
				jQuery( triangle.arcs[angle] ).each( function() { this.remove(); });
				triangle.arcs[angle] = KhanUtil.drawArcs( triangle.points[angle].coord, triangle.points[angle + 1].coord, triangle.points[angle + 2].coord, options.numArcs[angle] );
			}

			jQuery( triangle.lines ).each( function() {
				this.transform(true);
				this.toFront();
			});
			jQuery( triangle.points ).each( function() { this.toFront(); });
		}

		triangle.setRotationPoint = function( point ) {
			triangle.points[point].isRotationPoint = true;
			triangle.points[point].fixedDistance = { dist: triangle.radii[point], point: triangle.rotationPoint };

			triangle.points[point].onMove = function( dX, dY ) {
				var dAngle = KhanUtil.findAngle( triangle.points[point].coord, [ triangle.points[point].coord[0] - dX, triangle.points[point].coord[1] - dY ], triangle.rotationPoint.coord ) * Math.PI/180;
				for ( var i = 0; i < 4; ++i ) {
					if (i !== point) {				
						triangle.points[i].setCoord(
							(triangle.points[i].point.coordX - triangle.rotationPoint.coord[0]) * Math.cos(dAngle) - (triangle.points[i].point.coordY - triangle.rotationPoint.coord[1]) * Math.sin(dAngle) + triangle.rotationPoint.coord[0],
							(triangle.points[i].point.coordX - triangle.rotationPoint.coord[0]) * Math.sin(dAngle) + (triangle.points[i].point.coordY - triangle.rotationPoint.coord[1]) * Math.cos(dAngle) + triangle.rotationPoint.coord[1]
						);
					}
				}
				for (var i = 0; i < 3; ++i) {
					triangle.lines[i].transform( true );
				}
				triangle.update();
			};
		};

		
		for (var line = 0; line < 3; ++line) {
			triangle.lines[line].onMove = function( dX, dY ) {
				for (var i = 0; i < 4; ++i) {
					triangle.points[i].setCoord( triangle.points[i].point.coordX + dX, triangle.points[i].point.coordY + dY );
				}
				for (var i = 0; i < 3; ++i) {
					triangle.lines[i].transform( true );
				}
				triangle.update();
			};
			triangle.lines[line].onMoveEnd = function() {
				triangle.update();
			}
		}
		for (var point = 0; point < 4; ++point) {
			triangle.points[point].onMoveEnd = function( coordX, coordY ) {
				triangle.update();
			}
		}

		
		jQuery(".problem").append("<button id=\"reflect\">Reflect shape</button>");
		jQuery("button#reflect").bind("click", function( event ) {
			this.blur();
			var startPoints = jQuery.map( triangle.points, function( pt ) { return [[ pt.coord[0], pt.coord[1] ]]; } );
			var xMin = Math.min.apply(Math, jQuery.map( startPoints, function(x) { return x[0]; }));
			var xMax = Math.max.apply(Math, jQuery.map( startPoints, function(x) { return x[0]; }));
			var xMid = (xMin + xMax) / 2;
			var endPoints = jQuery.map( triangle.points, function( pt ) { return [[ xMid - pt.coord[0] + xMid, pt.coord[1] ]]; });

			var xCoords = {
				a: startPoints[0][0],
				b: startPoints[1][0],
				c: startPoints[2][0],
				d: startPoints[3][0]
			};
			
			jQuery( triangle.arcs[0] ).each( function() { this.remove(); });				
			jQuery( triangle.arcs[1] ).each( function() { this.remove(); });

		    jQuery( xCoords ).animate({
		    	a: endPoints[0][0],
				b: endPoints[1][0],
				c: endPoints[2][0],
				d: endPoints[3][0]
		    }, {
		      duration: 500,
		      easing: "linear",
		      step: function( now, fx ) {
		        triangle.points[0].setCoord( xCoords.a, startPoints[0][1] );
		        triangle.points[1].setCoord( xCoords.b, startPoints[1][1] );
		        triangle.points[2].setCoord( xCoords.c, startPoints[2][1] );
		        triangle.points[3].setCoord( xCoords.d, startPoints[3][1] );
		        triangle.lines[0].transform(true);
		        triangle.lines[1].transform(true);
		        triangle.lines[2].transform(true);
		      },
		      complete: function() {
		        triangle.points[0].setCoord( endPoints[0][0], endPoints[0][1] );
		        triangle.points[1].setCoord( endPoints[1][0], endPoints[1][1] );
		        triangle.points[2].setCoord( endPoints[2][0], endPoints[2][1] );
		        triangle.points[3].setCoord( endPoints[3][0], endPoints[3][1] );
		        triangle.points[0].meetConstraints();
		        triangle.points[1].meetConstraints();
		        triangle.points[2].meetConstraints();
		        triangle.points[3].meetConstraints();
		        triangle.update();
		      }
		    });
		    // flip the angles around
		    jQuery( triangle.points ).each( function( n, point ) {
		    	if ( typeof point.fixedAngle.angle === "number" ) {
		    		point.fixedAngle.angle *= -1;
		    	}
		    });
		    triangle.reflected = !triangle.reflected;
		});
		
		triangle.update();
		return triangle;
	},


	initCongruence: function( options ) {
		options = jQuery.extend({
			graph: KhanUtil.currentGraph,
			coord: [ [ 0, 0 ] , [ 1, 0] ],
			snap: 0,
			fixedLength: true,
			type: "SSA",
			ticks: [],
			numArcs: [ 0, 0, 0 ],
			reflected: false
		}, options);
		console.log(options.triangle);
		var graph = options.graph;

		options.sides = options.triangle.sideLengths.slice();
		options.angles = options.triangle.angles.slice();
		
		var randomAngle = function() {
			return Math.floor( KhanUtil.random() * 70 ) + 10;
		};
		var randomSide = function() {
			return KhanUtil.random() * 30 / 10 + 1;
		};
		
		if ( options.type === "SSS" ) {
			options.angles[0] = randomAngle();
			options.angles[1] = randomAngle();
			options.angles[2] = randomAngle();
			options.ticks = [ 1, 2, 3 ];
			var triangle = KhanUtil.addInteractiveTriangle( options );
			triangle.points[0].fixedDistance = { dist: options.sides[0], point: triangle.points[1] };
			triangle.setRotationPoint( 1 );
			triangle.setRotationPoint( 2 );
			triangle.points[3].fixedDistance = { dist: options.sides[2], point: triangle.points[2] };

			
		} else if ( options.type === "SSA" ) {
			options.angles[0] = randomAngle();
			options.angles[1] = randomAngle();
			options.sides[2] = randomSide();
			options.ticks = [ 1, 2, 0 ];
			options.numArcs = [ 0, 1, 0 ];
			var triangle = KhanUtil.addInteractiveTriangle( options );
			triangle.points[0].fixedDistance = { dist: options.sides[0], point: triangle.points[1] };
			triangle.setRotationPoint( 1 );
			triangle.points[2].fixedDistance = { dist: options.sides[1], point: triangle.points[1] };
			triangle.points[3].fixedAngle = { angle: options.angles[2] * (triangle.reflected ? 1 : -1), vertex: triangle.points[2], ref: triangle.points[1] };
			triangle.points[2].onMove = function( dX, dY ) {
				var orig = [ triangle.points[2].coord[0] - dX, triangle.points[2].coord[1] - dY ];
				triangle.points[3].fixedDistance = {
					dist: KhanUtil.distance(triangle.points[3].coord, orig),
					point: triangle.points[2]
				};
		 		triangle.points[3].meetConstraints();
		 		triangle.points[3].fixedDistance = {};
		        triangle.update();
		 	};

		} else if ( options.type === "SAS" ) {
			options.angles[0] = randomAngle();
			options.sides[2] = randomSide();			
			options.angles[2] = randomAngle();			
			options.ticks = [ 1, 2, 0 ];
			options.numArcs = [ 1, 0, 0 ];
			var triangle = KhanUtil.addInteractiveTriangle( options );
			triangle.setRotationPoint( 0 );
			triangle.points[1].fixedDistance = { dist: options.sides[1], point: triangle.points[2] };
			triangle.points[1].onMove = function( dX, dY ) {
				var orig = [ triangle.points[1].coord[0] - dX, triangle.points[1].coord[1] - dY ];
				var tmp = triangle.points[0].fixedDistance;
				triangle.points[0].fixedDistance = {
					dist: options.sides[0],
					point: triangle.points[1]
				};
				triangle.points[0].fixedAngle = {
					angle: options.angles[1] * (triangle.reflected ? -1 : 1),
					vertex: triangle.points[1],
					ref: triangle.points[2]
				};
		 		triangle.points[0].meetConstraints();
		 		triangle.points[0].fixedDistance = tmp;
		 		triangle.points[0].fixedAngle = {};
		        triangle.update();
		 	};
		 	triangle.setRotationPoint( 2 );
			
		} else if ( options.type === "SAA" ) {
			options.angles[0] = randomAngle();
			options.sides[1] = randomSide();
			options.sides[2] = randomSide();
			options.ticks = [ 1, 0, 0 ];
			options.numArcs = [ 1, 2, 0 ];
			var triangle = KhanUtil.addInteractiveTriangle( options );
			triangle.setRotationPoint( 0 );
			triangle.points[1].fixedAngle = { angle: options.angles[2] * (triangle.reflected ? -1 : 1), vertex: triangle.points[2], ref: triangle.points[3] };
			triangle.points[1].onMove = function( dX, dY ) {
				var orig = [ triangle.points[1].coord[0] - dX, triangle.points[1].coord[1] - dY ];
				triangle.points[0].fixedDistance = {
					dist: KhanUtil.distance(triangle.points[0].coord, orig),
					point: triangle.points[1]
				};
				triangle.points[0].fixedAngle = {
					angle: options.angles[1] * (triangle.reflected ? -1 : 1),
					vertex: triangle.points[1],
					ref: triangle.points[2]
				};
		 		triangle.points[0].meetConstraints();
		 		triangle.points[0].fixedDistance = {};
		 		triangle.points[0].fixedAngle = {};
		        triangle.update();
			}
			/*
			triangle.points[2].fixedAngle = { angle: options.angles[1] * (triangle.reflected ? 1 : -1), vertex: triangle.points[1], ref: triangle.points[0] };
			triangle.points[2].onMove = function( dX, dY ) {
				var orig = [ triangle.points[2].coord[0] - dX, triangle.points[2].coord[1] - dY ];
				triangle.points[3].fixedDistance = {
					dist: KhanUtil.distance(triangle.points[3].coord, orig),
					point: triangle.points[2]
				};
		 		triangle.points[3].meetConstraints();
		 		triangle.points[3].fixedDistance = {};
		        triangle.update();
			}
			*/
			triangle.setRotationPoint( 2 );
			triangle.points[3].fixedAngle = { angle: options.angles[2] * (triangle.reflected ? 1 : -1), vertex: triangle.points[2], ref: triangle.points[1] };
			
		} else if ( options.type === "ASA" ) {
			options.sides[0] = randomSide();
			options.angles[0] = randomAngle();
			options.sides[2] = randomSide();
			options.ticks = [ 0, 1, 0 ];
			options.numArcs = [ 1, 2, 0 ];
			var triangle = KhanUtil.addInteractiveTriangle( options );
			triangle.points[0].fixedAngle = { angle: options.angles[1] * (triangle.reflected ? -1 : 1), vertex: triangle.points[1], ref: triangle.points[2] };
			triangle.setRotationPoint( 1 );
			triangle.setRotationPoint( 2 );
			triangle.points[3].fixedAngle = { angle: options.angles[2] * (triangle.reflected ? 1 : -1), vertex: triangle.points[2], ref: triangle.points[1] };


		} else if ( options.type === "AAA" ) {
			options.sides[0] = randomSide();
			options.sides[1] = randomSide();
			options.sides[2] = randomSide();
			// TODO
		}
	},
	
	addTriangleDecorations: function( triangle, type ) {
		var ticks = [ 0, 0, 0 ];
		var arcs  = [ 0, 0, 0 ];
		if ( type === "SSS" ) {
			ticks = [ 1, 2, 3 ];
		} else if ( type === "SSA") {
			arcs  = [ 0, 0, 1 ];
			ticks = [ 1, 2, 0 ];
		} else if ( type === "SAS") {
			arcs  = [ 0, 1, 0 ];
			ticks = [ 1, 2, 0 ];
		} else if ( type === "SAA") {
			arcs  = [ 0, 1, 2 ];
			ticks = [ 1, 0, 0 ];
		} else if ( type === "ASA") {
			arcs  = [ 0, 1, 2 ];
			ticks = [ 0, 1, 0 ];
		} else if ( type === "AAA") {
			arcs  = [ 1, 2, 3 ];
		}

		KhanUtil.addMovableLineSegment({ coordA: triangle.points[0], coordZ: triangle.points[1], fixed: true, ticks: ticks[0], style: { stroke: "#b1c9f5", "stroke-width": 2 } });
		KhanUtil.addMovableLineSegment({ coordA: triangle.points[1], coordZ: triangle.points[2], fixed: true, ticks: ticks[1], style: { stroke: "#b1c9f5", "stroke-width": 2 } });
		KhanUtil.addMovableLineSegment({ coordA: triangle.points[2], coordZ: triangle.points[0], fixed: true, ticks: ticks[2], style: { stroke: "#b1c9f5", "stroke-width": 2 } });
		KhanUtil.drawArcs( triangle.points[2], triangle.points[0], triangle.points[1], arcs[0] );
		KhanUtil.drawArcs( triangle.points[0], triangle.points[1], triangle.points[2], arcs[1] );
		KhanUtil.drawArcs( triangle.points[1], triangle.points[2], triangle.points[0], arcs[2] );
		jQuery( triangle.set ).each( function() { this.toBack(); });
	}

});
