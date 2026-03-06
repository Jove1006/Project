function initThree() {
	scene = new THREE.Scene();
	scene.add(new THREE.AmbientLight(0x505050));

	pointLight = new THREE.PointLight("#ffffff");
	pointLight.position.set(500, 500, 500);
	pointLight.intensity = 1;
	pointLight.distance = 5000;

	directionalLight = new THREE.DirectionalLight("#ffffff");
	directionalLight.position.set(0, 0, 500);

	initCamera();

	renderer = new THREE.WebGLRenderer({
		antialias: true,
		alpha: true,
		logarithmicDepthBuffer: true
	});
	group = new THREE.Group();
	scene.add(group);
	if (userId == 5 || userId == 8) {
		renderer.setClearColor(ClearColor);
	}
	renderer.setPixelRatio(window.devicePixelRatio);
	renderer.setSize(window.innerWidth, window.innerHeight);
	renderer.setClearAlpha(ClearAlpha);
	document.body.appendChild(renderer.domElement);

	clipPlanes[0].negate();
	clipPlanes[1].negate();
}

function initCamera() {

	camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 1, 1e10);
	camera.add(pointLight);

	scene.add(camera);
}

// 旋转函数
function setCameraLookAtSide(side) {
	let sceneBox = new THREE.Box3();
	sceneBox.setFromObject(scene);
	let vecDiagonal = new THREE.Vector3();
	vecDiagonal.subVectors(sceneBox.max, sceneBox.min);
	let diagonalLength = vecDiagonal.length();
	let tempValue = 1.5 * diagonalLength;
	switch(side){
		case 'FRONT':
			camera.position.copy(controls.target).y -= tempValue;
			break;
		case 'BACK':
			camera.position.copy(controls.target).y += tempValue;
			break;
		case 'LEFT':
			camera.position.copy(controls.target).x += tempValue;
			break;
		case 'RIGHT':
			camera.position.copy(controls.target).x -= tempValue;
			break;
		case 'TOP':
			camera.position.copy(controls.target).z += tempValue;
			break;
		case 'BOTTOM':
			camera.position.copy(controls.target).z -= tempValue;
			break;
	}
	
}

function adjustCameraAuto(atOnce=false) {
	setTimeout(function () {
		let sceneBox = new THREE.Box3();
		sceneBox.setFromObject(scene);
		sceneBox.getCenter(controls.target);
		let vecDiagonal = new THREE.Vector3();
		vecDiagonal.subVectors(sceneBox.max, sceneBox.min);
		let diagonalLength = vecDiagonal.length();
		let tempValue = 1.5 * diagonalLength;
		camera.up.set(0, 0, 1);
		camera.position.copy(controls.target).y -= tempValue;
		controls.update();
		timeRender();
	}, atOnce ? 0 : 2000);
}
function initObject() {
	let loadManager = new THREE.LoadingManager();
	loadManager.onLoad = function () {
		adjustCameraAuto();
		let interval = setInterval(function () {
			if (document.getElementById("loading").style.display != "none") {
				document.getElementById("loading").style.display = "none";
				scene.add(objgroup);
				clearInterval(interval);
			}
		}, 2000);
	};
	for (var i = 0; i < stlfiles.length; i++) {
		loadfile(stlfiles[i].stlfilePath, stlfiles[i].volume, stlfiles[i].stlname, stlfiles[i].filecolor, stlfiles[i].opacity, stlfiles[i].visible, stlfiles[i].wireframe, i, loadManager);
	}
}

function initHuman() {
	const insetWidth = 80,
		insetHeight = 80;
	container2 = document.getElementById('inset');
	container2.width = insetWidth;
	container2.height = insetHeight;
	renderer2 = new THREE.WebGLRenderer({
		alpha: true
	});
	renderer2.setSize(insetWidth, insetHeight);
	container2.appendChild(renderer2.domElement);
	scene2 = new THREE.Scene();
	camera2 = new THREE.PerspectiveCamera(50, insetWidth / insetHeight, 0.01, 1e10);
	camera2.up = camera.up;
	pointLight = new THREE.PointLight("#ffffff");
	pointLight.position.set(0, 0, 1000);
	pointLight.intensity = 1;
	pointLight.distance = 5000;
	camera2.add(pointLight);

	scene2.add(camera2);
	let loadManager = new THREE.LoadingManager();
	var loader = new THREE.DRACOLoader(loadManager);
	loader.load('/static/webgln/data/HumanAll.drc', function (geometry) {
		geometry.center();
		var material = new THREE.MeshPhongMaterial({
			color: '#ffffff'
		});
		var mesh = new THREE.Mesh(geometry, material);
		mesh.scale.multiplyScalar(1);
		mesh.rotation.z = Math.PI;
		geometry.computeVertexNormals();
		axes2 = mesh;
		scene2.add(mesh);
	});
}

function initControl() {
	controls = new THREE.CustomTrackballControls(camera, renderer.domElement);
	controls.rotateSpeed = 5;
	controls.zoomSpeed = 5;
	controls.panSpeed = 2;
	controls.staticMoving = true;
	controls.dynamicDampingFactor = 0.3;
	controls.addEventListener('change', render);

	controlsd = new THREE.DragControls([...meshobjects], camera, renderer.domElement);
	controlsd.addEventListener('drag', render);

	window.addEventListener('resize', onWindowResize, false);

	document.addEventListener('click', onClick, false);
	document.addEventListener('mousedown', function (e) {
		clickFlag = true;
		start.x = e.offsetX;
		start.y = e.offsetY;
	});
	document.addEventListener('touchstart', function (e) {
		clickFlag = true;
		start.x = e.offsetX;
		start.y = e.offsetY;
	});
	document.addEventListener('mousemove', function (e) {
		var x = e.offsetX;
		var y = e.offsetY;
		end.x = e.offsetX;
		end.y = e.offsetY;
		var d = Math.sqrt((x - start.x) * (x - start.x) + (y - start.y) * (y - start.y));
		if (d > 1) {
			clickFlag = false;
		}
	});
	document.addEventListener('touchmove', function (e) {
		var x = e.offsetX;
		var y = e.offsetY;
		end.x = e.offsetX;
		end.y = e.offsetY;
		var d = Math.sqrt((x - start.x) * (x - start.x) + (y - start.y) * (y - start.y));
		if (d > 1) {
			clickFlag = false;
		}
	});
	// window.addEventListener( 'keydown', onKeyDown, false );
	// window.addEventListener( 'keyup', onKeyUp, false );
}

function initRaycaster() {
	raycaster = new THREE.Raycaster(); //光线投射器
	mouse = new THREE.Vector2(); //二维向量
	window.addEventListener('click', onMouseClick, false);
	window.addEventListener('touchstart', onMouseClick, false);
}

function onMouseClick(event) {
	if (clickFlag) {
		if (event.srcElement.tagName != "CANVAS") {
			return;
		}
		if (event.touches) {
			mouse.x = (event.touches[0].pageX / window.innerWidth) * 2 - 1;
			mouse.y = -(event.touches[0].pageY / window.innerHeight) * 2 + 1;
		} else {
			mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
			mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
		}
		if (MeasureType == "none") {
			var vector = new THREE.Vector3(mouse.x, mouse.y, 0).unproject(camera);
			var spriteRaycaster = new THREE.Raycaster(camera.position, vector.sub(camera.position).normalize());
			spriteRaycaster.setFromCamera(new THREE.Vector2(mouse.x, mouse.y), camera);
			var spriteList = [];
			drawTexts.forEach(function (value) {
				spriteList.push(value);
			});
			var spriteObjList = spriteRaycaster.intersectObjects(spriteList);
			setTagFontToNoSelect();
			if (spriteObjList[0]) {
				needDeleteTag = spriteObjList[0];
				setTagFontToSelect(spriteObjList[0].object.uuid);
				clickFlag = false;
			}
		}
		raycaster.setFromCamera(mouse, camera);

		var visibleMeshObjects = [];
		for (var i = 0; i < meshobjects.length; i++) {
			if (meshobjects[i].material.opacity != 0 && meshobjects[i].material.visible) {
				visibleMeshObjects.push(meshobjects[i]);
			}
		}

		if (SelectPart || MeasureType == "none") {
			for (var i = 0; i < stlfiles.length; i++) {
				stlfiles[i].selected = false;
			}
			var intersects = raycaster.intersectObjects(visibleMeshObjects);
			var meshID = "";
			var breaked = false;
			for (var j = 0; j < intersects.length; j++) {
				for (var i = 0; i < stlfiles.length; i++) {
					if ((intersects[j].object.id) == (stlfiles[i].meshID)) {
						stlfiles[i].selected = true;
						meshID = stlfiles[i].meshID;
						breaked = true;
						break;
					}
				}
				if (breaked) {
					break;
				}
			}
			openMeshSetup(meshID);
			clickFlag = false;
			return;
		}
		var intersects = raycaster.intersectObjects(visibleMeshObjects);

		if (intersects.length > 0) {
			var intersected = intersects[0].object;

			var geometry = new THREE.SphereGeometry(1.0);
			var material = new THREE.MeshBasicMaterial({
				color: 0xffff00
			});
			var sphere = new THREE.Mesh(geometry, material);
			sphere.position.x = intersects[0].point.x;
			sphere.position.y = intersects[0].point.y;
			sphere.position.z = intersects[0].point.z;

			drawPoints.set(sphere.uuid, sphere);
			clickedPoints.push(sphere);

			relatingModelArr.push(intersected.model_id);
			sphere.userType = 'userMeasure';

			scene.add(sphere);
			switch (MeasureType) {
				case 'distance':
					if (clickedPoints.length == 2) {
						clickedPoints[0].relatingModel = relatingModelArr;
						clickedPoints[1].relatingModel = relatingModelArr;
						drawLine(relatingModelArr);
					}
					break;
				case 'angle':
					if (clickedPoints.length == 3) {
						clickedPoints[0].relatingModel = relatingModelArr;
						clickedPoints[1].relatingModel = relatingModelArr;
						clickedPoints[2].relatingModel = relatingModelArr;
						drawLine(relatingModelArr);
					}
					break;
				case 'label':
					if (clickedPoints.length == 1) {
						clickedPoints[0].relatingModel = relatingModelArr
						labelInput = window.prompt('请输入标签：');
						if (labelInput) {
							drawLine(this.relatingModelArr);
						} else if (this.labelInput === '') {
							labelInput = '未定义标签';
							drawLine(this.relatingModelArr);
						} else {
							scene.remove(sphere);
							clickedPoints = [];
							relatingModelArr = []
						}
					}
					break;
			}
		}
		clickFlag = false;
		timeRender();
	}
}

function drawLine(arr) {
	var obj = {
		type: MeasureType,
		pointsIndex: [],
		linesIndex: [],
		textsIndex: [],
		line3: []
	};

	obj.pointsIndex.push(clickedPoints[0].uuid);

	for (var i = 1; i < clickedPoints.length; i++) {
		var start = clickedPoints[i - 1];
		var end = clickedPoints[i];

		obj.pointsIndex.push(end.uuid);

		var line3 = new THREE.Line3(start.position, end.position);
		obj.line3.push(line3);

		var geometry = new THREE.BufferGeometry();
		var positions = new Float32Array(2 * 3); // 每个顶点的坐标有3个浮点数
		positions[0] = line3.start.x;
		positions[1] = line3.start.y;
		positions[2] = line3.start.z;
		positions[3] = line3.end.x;
		positions[4] = line3.end.y;
		positions[5] = line3.end.z;
		geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3)); // 指定位置属性

		var material = new THREE.LineBasicMaterial({ color: 0xff0000 });

		var line = new THREE.LineSegments(geometry, material);

		drawLines.set(line.uuid, line);

		obj.linesIndex.push(line.uuid);
		line.relatingModel = arr;
		line.userType = 'userMeasure';
		scene.add(line);

	}

	// 添加 text
	var sprite = null;
	switch (obj.type) {
		case 'distance':
			var message = ((obj.line3[0].distance())).toFixed(2) + 'mm';
			var position = {};
			position.x = clickedPoints[1].position.x;
			position.y = clickedPoints[1].position.y;
			position.z = clickedPoints[1].position.z;
			sprite = drawText(message, position, arr);
			break;
		case 'angle':

			let vp1 = new THREE.Vector3(obj.line3[0].start.x, obj.line3[0].start.y, obj.line3[0].start.z)
			let vp2 = new THREE.Vector3(obj.line3[0].end.x, obj.line3[0].end.y, obj.line3[0].end.z)
			let vp3 = new THREE.Vector3(obj.line3[1].end.x, obj.line3[1].end.y, obj.line3[1].end.z)

			let v1 = vp1.clone().sub(vp2)
			let v2 = vp3.clone().sub(vp2)

			var angle = v1.angleTo(v2) * 180 / Math.PI;

			var message = angle.toFixed(2) + '°';
			var position = {};
			position.x = clickedPoints[1].position.x;
			position.y = clickedPoints[1].position.y;
			position.z = clickedPoints[1].position.z;
			sprite = drawText(message, position, arr);
			break;
		case 'label':
			var message = labelInput;
			var position = {};
			position.x = clickedPoints[0].position.x;
			position.y = clickedPoints[0].position.y;
			position.z = clickedPoints[0].position.z;
			sprite = drawText(message, position, arr);
			break;
		default:
	}

	obj.textsIndex.push(sprite.uuid);

	measureObj.set(sprite.uuid, obj);

	clickedPoints = [];
	relatingModelArr = [];
}

function drawText(message, position, arr) {
	var sprite = makeTextSprite(message, {
		fontColor: {
			r: 255,
			g: 255,
			b: 255,
			a: 1
		},
		backgroundColor: {
			r: 20,
			g: 33,
			b: 53,
			a: 0.65
		},
		position: position,
		measureObjKey: null
	});

	drawTexts.set(sprite.uuid, sprite);
	sprite.userType = 'userMeasure'
	sprite.relatingModel = arr
	scene.add(sprite);

	setTagFontToNoSelect()
	setTagFontToSelect(sprite.uuid)
	needDeleteTag.object = sprite
	return sprite;
}

function drawDistanceMarkerText(message, position, arr) {
	var sprite = makeTextSprite(message, {
		fontColor: {
			r: 255,
			g: 255,
			b: 255,
			a: 1
		},
		backgroundColor: {
			r: 20,
			g: 33,
			b: 53,
			a: 0.65
		},
		position: position,
		measureObjKey: null
	});

	drawTexts.set(sprite.uuid, sprite);
	sprite.userType = 'distanceMarkerItem'
	sprite.relatingModel = arr
	scene.add(sprite);

	return sprite;
}

function clearDistanceMarkers() {
	for (let [key, value] of measureObj) {
		let deleteMeasureObj = measureObj.get(key);
		if (deleteMeasureObj.type == "DistanceMarker") {
			for (let i = 0; i < deleteMeasureObj.pointsIndex.length; i++) {
				let idx = deleteMeasureObj.pointsIndex[i];
				let deletePoint = drawPoints.get(idx);
				scene.remove(deletePoint);
				drawPoints.delete(idx);
			}
			for (let i = 0; i < deleteMeasureObj.linesIndex.length; i++) {
				let idx = deleteMeasureObj.linesIndex[i];
				let deleteLine = drawLines.get(idx);
				scene.remove(deleteLine);
				drawLines.delete(idx);
			}
			for (let i = 0; i < deleteMeasureObj.textsIndex.length; i++) {
				let idx = deleteMeasureObj.textsIndex[i];
				let deleteText = drawTexts.get(idx);
				scene.remove(deleteText);
				drawTexts.delete(idx);
			}
			measureObj.delete(key);
		}
	}
}

function makeTextSprite(message, parameters) {
	if (parameters === undefined) parameters = {};
	let fontface = parameters.hasOwnProperty("fontface") ?
		parameters["fontface"] : "Verdana";
	let fontsize = parameters.hasOwnProperty("fontsize") ?
		parameters["fontsize"] : 40;
	let fontColor = parameters.hasOwnProperty("fontColor") ?
		parameters["fontColor"] : {
			r: 0,
			g: 0,
			b: 0,
			a: 1.0
		};
	let borderThickness = parameters.hasOwnProperty("borderThickness") ?
		parameters["borderThickness"] : 8;
	let borderColor = parameters.hasOwnProperty("borderColor") ?
		parameters["borderColor"] : {
			r: 0,
			g: 0,
			b: 0,
			a: 1.0
		};
	let backgroundColor = parameters.hasOwnProperty("backgroundColor") ?
		parameters["backgroundColor"] : {
			r: 255,
			g: 255,
			b: 255,
			a: 1.0
		};
	let position = parameters.hasOwnProperty("position") ?
		parameters["position"] : {
			x: 0,
			y: 0,
			z: 0
		};
	let measureObjIndex = parameters.hasOwnProperty("measureObjIndex") ?
		parameters["measureObjIndex"] : 0;
	let messageLengthHelpCanvas = document.createElement('canvas');
	let messageLengthHelpContext = messageLengthHelpCanvas.getContext('2d');
	messageLengthHelpContext.font = "Bold " + fontsize + "px " + fontface;
	let messageLengthHelpMetrics = messageLengthHelpContext.measureText(message);
	let canvas = document.createElement('canvas');
	canvas.width = Math.ceil(messageLengthHelpMetrics.width / 300) * 300 + borderThickness * 2;
	let context = canvas.getContext('2d');
	context.font = "Bold " + fontsize + "px " + fontface;
	let metrics = context.measureText(message);
	let textWidth = metrics.width;

	let canvasWidth = canvas.width
	let scaleX = canvasWidth * 80 / 300
	context.fillStyle = "rgba(" + backgroundColor.r + "," + backgroundColor.g + "," +
		backgroundColor.b + "," + backgroundColor.a + ")";
	context.strokeStyle = "rgba(" + borderColor.r + "," + borderColor.g + "," +
		borderColor.b + "," + borderColor.a + ")";
	context.lineWidth = borderThickness;
	roundRect(context, borderThickness / 2, borderThickness / 2, textWidth + borderThickness, fontsize * 1.4 + borderThickness, 12);
	context.fillStyle = "rgba(0, 0, 0, 1.0)";
	context.fillStyle = "rgba(" + fontColor.r + "," + fontColor.g + "," +
		fontColor.b + "," + fontColor.a + ")";
	context.fillText(message, borderThickness, fontsize + borderThickness);
	let texture = new THREE.CanvasTexture(canvas);

	let spriteMaterial = new THREE.SpriteMaterial({
		map: texture
	});
	spriteMaterial.depthTest = false;

	let sprite = new THREE.Sprite(spriteMaterial);
	sprite.measureObjIndex = measureObjIndex;
	sprite.center = new THREE.Vector2(0, 1);
	sprite.scale.set(scaleX, 40, 1);
	sprite.position.x = position.x;
	sprite.position.y = position.y;
	sprite.position.z = position.z;

	return sprite;
}

function roundRect(ctx, x, y, w, h, r) {
	ctx.beginPath();
	ctx.moveTo(x + r, y);
	ctx.lineTo(x + w - r, y);
	ctx.quadraticCurveTo(x + w, y, x + w, y + r);
	ctx.lineTo(x + w, y + h - r);
	ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
	ctx.lineTo(x + r, y + h);
	ctx.quadraticCurveTo(x, y + h, x, y + h - r);
	ctx.lineTo(x, y + r);
	ctx.quadraticCurveTo(x, y, x + r, y);
	ctx.closePath();
	ctx.fill();
};

function setTagFontToNoSelect() {

	for (let i in scene.children) {
		if (scene.children[i].type == 'Sprite') {
			scene.children[i].userSelect = false
			scene.children[i].material.color.g = 1;
			scene.children[i].material.color.b = 1;
			scene.children[i].material.color.r = 1;
		}

	}
}

function setTagFontToSelect(uuid) {

	for (let i in scene.children) {

		if (scene.children[i].type == 'Sprite' && scene.children[i].uuid == uuid) {
			scene.children[i].userSelect = true
			scene.children[i].material.color.r = 1;
			scene.children[i].material.color.g = 0.8;
			scene.children[i].material.color.b = 0.2;
		}

	}
}

function openMeshSetup(meshID) {
	if (meshID == "") {
		return;
	}
	for (var i = 0; i < stlfiles.length; i++) {
		if (stlfiles[i].selected == true) {
			var oDiv = document.getElementById("div_stlfiles");
			var oUL = document.getElementById("stlfiles");
			oDiv.style.display = "";
			oUL.style.display = "";
			var oLis = oUL.getElementsByTagName("li");
			for (var j = 0; j < oLis.length; j++) {
				if (oLis[j].getAttribute('meshID') == meshID) {
					oLis[j].style.borderColor = "#F1C40F";
					oLis[j].scrollIntoView({ behavior: "smooth", block: "end", inline: "start" });
				} else {
					oLis[j].style.borderColor = "#0A6EBD";
				}
			}
			break;
		}
	}
}

function loadfile(stlfilePath, filevolume, stlfilename, filecolor, fileopacity, filevisible, filewireframe, fileindex, loadManager) {

	var onProgress = function (xhr) {
		if (xhr.lengthComputable) {
			var percentComplete = xhr.loaded / xhr.total * 100;
			totalprogress[fileindex] = percentComplete;
			let sum = 0;
			for (let i = 0; i < totalprogress.length; i++) sum += totalprogress[i];
			let result = (sum / stlfiles.length).toFixed(2);
			if (!isNaN(result)) document.getElementById("percent").innerHTML = result + '%';
		}
	};
	var onError = function (xhr) { };
	var loader = new THREE.DRACOLoader(loadManager);
	loader.setDecoderPath('/static/webgln/js/dev/');
    loader.setDecoderConfig({ type: 'js' });
	loader.load(stlfilePath, function (geometry) {
		var material = new THREE.MeshLambertMaterial({  // 使用 MeshLambertMaterial
			name: stlfilename,
			color: filecolor,
			visible: filevisible,
			side: THREE.DoubleSide,
			transparent: true,
			clippingPlanes: clipPlanes,
			clipIntersection: false,
		});

		var mesh = new THREE.Mesh(geometry, material);
		mesh.geometry.computeBoundingBox()
		mesh.name = stlfilename;
		meshobjects.push(mesh);
		meshpos.push(mesh.position);

		objgroup.add(mesh);
		objbox = new THREE.Box3().setFromObject(objgroup);

		geometry.computeVertexNormals();

		meshloadindex.push(fileindex);
		scene.add(mesh);

		onSpecificModel(stlfilename, geometry);
	}, onProgress, onError);
}

function computeBufferGeometryVolume(geometry) {
  // 确保几何体已经转换为非索引形式（即每个三角形都有独立的顶点）
  const nonIndexedGeo = geometry.index ? geometry.toNonIndexed() : geometry;
  const posAttr = nonIndexedGeo.getAttribute('position');
  let volume = 0;

  for (let i = 0; i < posAttr.count; i += 3) {
    const ax = posAttr.getX(i);
    const ay = posAttr.getY(i);
    const az = posAttr.getZ(i);

    const bx = posAttr.getX(i + 1);
    const by = posAttr.getY(i + 1);
    const bz = posAttr.getZ(i + 1);

    const cx = posAttr.getX(i + 2);
    const cy = posAttr.getY(i + 2);
    const cz = posAttr.getZ(i + 2);

    // 用混合积公式计算三角面与原点组成四面体的体积
    volume += (ax * (by * cz - bz * cy)
             - ay * (bx * cz - bz * cx)
             + az * (bx * cy - by * cx)) / 6.0;
  }

  return Math.abs(volume); // 返回体积的绝对值
}


function onSpecificModel(name, geometry) {
	if (name == "子宫" || name == "肌瘤") {

	}
}

function featureMeasureUterus() {
	let markers = orderInfo.attachment.distance_markers;
	let statusText = $("#feature-item-status1");
	if (statusText.text() == "关闭") {
		clearDistanceMarkers();
		statusText.removeClass("bg-secondary");
		statusText.text("打开");
		statusText.addClass("bg-success");
		$(".popup").hide();
		return;
	}
	statusText.removeClass("bg-success");
	statusText.text("关闭");
	statusText.addClass("bg-secondary");
	if (!markers) {
		$(".popup").hide();
		return;
	}
	for (let i = 0; i < markers.length; i++) {
		let obj = {
			type: "DistanceMarker",
			pointsIndex: [],
			linesIndex: [],
			textsIndex: [],
			line3: []
		};
		let target1 = {
			point: {
				x: markers[i].p1[0],
				y: markers[i].p1[1],
				z: markers[i].p1[2],
			}
		};
		let target2 = {
			point: {
				x: markers[i].p2[0],
				y: markers[i].p2[1],
				z: markers[i].p2[2],
			}
		};

		let geometry;
		geometry = new THREE.SphereGeometry(1.0);
		let material;
		material = new THREE.MeshBasicMaterial({
			color: 0xeb984e
		});
		let sphere;
		sphere = new THREE.Mesh(geometry, material);
		sphere.position.x = target1.point.x;
		sphere.position.y = target1.point.y;
		sphere.position.z = target1.point.z;
		drawPoints.set(sphere.uuid, sphere);
		obj.pointsIndex.push(sphere.uuid);
		sphere.userType = 'distanceMarkerItem';
		scene.add(sphere);
		sphere = new THREE.Mesh(geometry, material);
		sphere.position.x = target2.point.x;
		sphere.position.y = target2.point.y;
		sphere.position.z = target2.point.z;
		drawPoints.set(sphere.uuid, sphere);
		obj.pointsIndex.push(sphere.uuid);
		sphere.userType = 'distanceMarkerItem';
		scene.add(sphere);
		let line3 = new THREE.Line3(target1.point, target2.point);
		geometry = new THREE.BufferGeometry();
		let positions = new Float32Array(2 * 3);
		positions[0] = line3.start.x;
		positions[1] = line3.start.y;
		positions[2] = line3.start.z;
		positions[3] = line3.end.x;
		positions[4] = line3.end.y;
		positions[5] = line3.end.z;
		geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
		material = new THREE.LineBasicMaterial({ color: 0xff0000 });
		let line = new THREE.LineSegments(geometry, material);
		drawLines.set(line.uuid, line);
		obj.linesIndex.push(line.uuid);
		line.userType = 'distanceMarkerItem';
		scene.add(line);
		let message = (markers[i].d).toFixed(2) + 'mm';
		sprite = drawDistanceMarkerText(message, line3.start, []);
		obj.textsIndex.push(sprite.uuid);
		measureObj.set(sprite.uuid, obj);
	}
	$(".popup").hide();
}

function onWindowResize() {
	camera.aspect = window.innerWidth / window.innerHeight;
	camera.updateProjectionMatrix();
	renderer.setSize(window.innerWidth, window.innerHeight);
	controls.handleResize();
	timeRender();
}


function onClick(event) {
	event.preventDefault();
	if (SelectPart) {
		enableSelection = true;
		controls.enabled = false;
		controlsd.enabled = true;
	} else {
		enableSelection = false;
		controls.enabled = true;
		controlsd.enabled = false;
	}
	if (enableSelection === true) {
		var draggableObjects = controlsd.getObjects();
		draggableObjects.length = 0;

		mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
		mouse.y = - (event.clientY / window.innerHeight) * 2 + 1;

		raycaster.setFromCamera(mouse, camera);

		var intersections = raycaster.intersectObjects(meshobjects, true);
		if (intersections.length > 0) {
			var object = intersections[0].object;

			if (group.children.includes(object) === true) {

				object.material.emissive.set(0xff0000);
				scene.attach(object);

			}
			controlsd.transformGroup = true;
		} else {
		}
		if (group.children.length === 0) {
			controlsd.transformGroup = false;
			draggableObjects.push(...meshobjects);
		}
	}
	timeRender();
}



function animate() {
	requestAnimationFrame(animate);
	if (RotatePlay) {
		objgroup.rotation.y += 0.01;
		renderer.render(scene, camera);
	}
	controls.update();
	// controlsd.update();
	if (enableRender) {
		render();
	}
}

function timeRender() {
	enableRender = true;
	if (renderTimeout) clearTimeout(renderTimeout);
	renderTimeout = setTimeout(function () {
		enableRender = false;
	}, 300);
}

function render() {
	if (userId == 5 || userId == 8) {
		renderer.setClearColor(ClearColor);
	}
	renderer.setClearAlpha(ClearAlpha);
	if (meshobjects.length == stlfiles.length) {
		document.getElementById("loading").style.display = "none";
		var tmpmeshinfo = '';
		var orderedMeshObjects = [];
		for (let i = 0; i < stlfiles.length; i++) {
			for (let j = 0; j < meshobjects.length; j++) {
				if (stlfiles[i].stlname == meshobjects[j].name) {
					orderedMeshObjects.push(meshobjects[j]);
					break;
				}
			}
		}
		meshobjects = orderedMeshObjects;
		meshloadindex = meshloadindex.sort(function (a, b) { return a - b });
		for (var i = 0; i < meshobjects.length; i++) {
			//这里计算体积
			if (in_array(stlfiles[meshloadindex[i]].cateid, cateselectid)) {
				//stlfiles[meshloadindex[i]].visible = true
				meshobjects[i].material.visible = true
			} else {
				//stlfiles[meshloadindex[i]].visible = false
				meshobjects[i].material.visible = false
			}
			if (stlfiles[meshloadindex[i]].volume == "0.00ml") {
				stlfiles[meshloadindex[i]].volume = (computeBufferGeometryVolume(meshobjects[i].geometry) / 1000).toFixed(2) + 'ml';
				stlfiles[meshloadindex[i]].meshID = meshobjects[i].id;
				stlfiles[meshloadindex[i]].OrderID = meshloadindex[i];

				tmpmeshinfo = tmpmeshinfo + '    <li data-cate="###cateid###" id="stlfile###index###" objectnum="###index###" class="stlfile" oldbackground="###filecolor###" alt="###stlname###" oldopacity="###opacity###"  meshID="###meshID###">' + '\n';
				tmpmeshinfo = tmpmeshinfo + '<div class="controls-header">' + '\n';
				tmpmeshinfo = tmpmeshinfo + '<div class="title" id="title###index###">###stlname###</div>' + '\n';
				tmpmeshinfo = tmpmeshinfo + '<div class="volume" id="volume###index###">体积 ###volume###</div>' + '\n';
				tmpmeshinfo = tmpmeshinfo + '</div>' + '\n';
				tmpmeshinfo = tmpmeshinfo + '<div class="controls-contianer">' + '\n';
				// tmpmeshinfo = tmpmeshinfo + '<div class="show" id="show###index###">显示 ###visible###</div>' + '\n';
				tmpmeshinfo = tmpmeshinfo + '<div><div id="show###index###" style="display:flex;justify-content: center; align-items:center; margin-right:2px;" onclick="setvisible(event,###index###)"><svg t="1689484687001" class="icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="3050" width="20" height="20"><path d="M942.2 486.2C847.4 286.5 704.1 186 512 186c-192.2 0-335.4 100.5-430.2 300.3-7.7 16.2-7.7 35.2 0 51.5C176.6 737.5 319.9 838 512 838c192.2 0 335.4-100.5 430.2-300.3 7.7-16.2 7.7-35 0-51.5zM512 766c-161.3 0-279.4-81.8-362.7-254C232.6 339.8 350.7 258 512 258c161.3 0 279.4 81.8 362.7 254C791.5 684.2 673.4 766 512 766z" p-id="3051" fill="#e6e6e6"></path><path d="M508 336c-97.2 0-176 78.8-176 176s78.8 176 176 176 176-78.8 176-176-78.8-176-176-176z m0 288c-61.9 0-112-50.1-112-112s50.1-112 112-112 112 50.1 112 112-50.1 112-112 112z" p-id="3052" fill="#e6e6e6"></path></svg></div></div>' + '\n';
				tmpmeshinfo = tmpmeshinfo + '<div class="opacity" id="opacity###index###" onclick="setopacity(###index###);">透明度 ###opacity###% </div>' + '\n';
				tmpmeshinfo = tmpmeshinfo + '<div class="color" id="color###index###"><div class="color-display" style=" background:###filecolor###;"> </div></div>' + '\n';
				tmpmeshinfo = tmpmeshinfo + '</div>' + '\n';

				tmpmeshinfo = tmpmeshinfo + '    </li>' + '\n';

				var word = "###cateid###";
				var newWorld = stlfiles[meshloadindex[i]].cateid;
				tmpmeshinfo = tmpmeshinfo.replace(new RegExp(word, 'g'), newWorld);


				var word = "###index###";
				var newWorld = i;
				tmpmeshinfo = tmpmeshinfo.replace(new RegExp(word, 'g'), newWorld);

				var word = "###meshID###";
				var newWorld = stlfiles[meshloadindex[i]].meshID;
				tmpmeshinfo = tmpmeshinfo.replace(new RegExp(word, 'g'), newWorld);

				var word = "###filecolor###";
				var newWorld = stlfiles[meshloadindex[i]].filecolor;
				tmpmeshinfo = tmpmeshinfo.replace(new RegExp(word, 'g'), newWorld);

				var word = "###stlname###";
				var newWorld = stlfiles[meshloadindex[i]].stlname;
				tmpmeshinfo = tmpmeshinfo.replace(new RegExp(word, 'g'), newWorld);

				var word = "###opacity###";
				var newWorld = stlfiles[meshloadindex[i]].opacity * 100;
				tmpmeshinfo = tmpmeshinfo.replace(new RegExp(word, 'g'), newWorld);

				var word = "###volume###";
				var newWorld = stlfiles[meshloadindex[i]].volume;
				tmpmeshinfo = tmpmeshinfo.replace(new RegExp(word, 'g'), newWorld);
				var word = "###visible###";
				var newWorld = stlfiles[meshloadindex[i]].visible;
				tmpmeshinfo = tmpmeshinfo.replace(new RegExp(word, 'g'), newWorld);
			}

			//设置颜色
			meshobjects[i].material.color.set(stlfiles[meshloadindex[i]].filecolor);

			//设置透明度情况下是否占位
			if (stlfiles[meshloadindex[i]].visible == true) {
				if (stlfiles[meshloadindex[i]].opacity < 1) {
					meshobjects[i].material.transparent = true;
                    if (stlfiles[meshloadindex[i]].stlname.indexOf("肾") != -1) {
                        meshobjects[i].material.depthWrite = true;
                    } else {
                        meshobjects[i].material.depthWrite = false;
                    }
				} else {
					meshobjects[i].material.transparent = false;
					meshobjects[i].material.depthWrite = true;
				}
				//设置透明度
				meshobjects[i].material.opacity = stlfiles[meshloadindex[i]].opacity;
				meshobjects[i].material.wireframe = stlfiles[meshloadindex[i]].wireframe;
			} else {
				meshobjects[i].material.transparent = true;
				meshobjects[i].material.depthWrite = false;
				meshobjects[i].material.opacity = 0;
				meshobjects[i].material.wireframe = stlfiles[meshloadindex[i]].wireframe;
			}


			if (stlfiles[meshloadindex[i]].selected == true) {
				if (SelectPart == true) {
					meshobjects[i].material.color.set(0xffffff);
				}
			}
		}
		if (document.getElementById("stlfiles").innerHTML == '') {
			tmpmeshinfo = '<li class="closeAllopacity" onclick="initstlfiles();" alt="关闭全部">' + '\n' +
				'    <span class="opacity">&nbsp;</span>' + '\n' +
				'    <span class="stlname" id="closeAllopacity">全部关闭</span>' + '\n' +
				'    <span class="volume">&nbsp;</span>' + '\n' +
				'    </li>' + '\n' +
				tmpmeshinfo;
			document.getElementById("stlfiles").innerHTML = tmpmeshinfo;
			thisshow()
		}
	}

	clipx = $('.sliderx').next('.slider-container').find('.back-bar').find('.pointer-label').text();
	clipy = $('.slidery').next('.slider-container').find('.back-bar').find('.pointer-label').text();
	clipz = $('.sliderz').next('.slider-container').find('.back-bar').find('.pointer-label').text();
	clipPlanes[0].constant = clipx;
	clipPlanes[1].constant = clipy;
	clipPlanes[2].constant = clipz;

	renderer.render(scene, camera);
}

function changebgcolor() {
	if (userId == 5 || userId == 8) {
		switch (ClearAlpha) {
			case 1:
				ClearAlpha = 0;
				break;
			case 0.75:
				ClearAlpha = 1;
				break;
			case 0.5:
				ClearAlpha = 0.75;
				break;
			case 0.25:
				ClearAlpha = 0.5;
				break;
			case 0:
				ClearAlpha = 0.25;
				break;
		}
	} else {
		switch (ClearAlpha) {
			case 0.9:
				ClearAlpha = 0;
				break;
			case 0.75:
				ClearAlpha = 0.9;
				break;
			case 0.5:
				ClearAlpha = 0.75;
				break;
			case 0.25:
				ClearAlpha = 0.5;
				break;
			case 0:
				ClearAlpha = 0.25;
				break;
		}
	}
}


function changePart() {
	controls.update(false);
	for (var a = 0; a < stlfiles.length; a++) {
		meshobjects[a].position.set(0, 0, 0);
	}
}


function clippingPart() {
	$('.tanchu').toggle();
	var flag = $(".tanchu").is(":hidden");
	console.log(clipx, clipy, clipz);
	if (!clippingflag) {
		renderer.localClippingEnabled = true;
		console.log(clipx, clipy, clipz);
		if (clipx) {
			clipx = clipx;
		} else {
			clipx = objbox.max.x + 200;
		}
		if (clipy) {
			clipy = clipy;
		} else {
			clipy = objbox.max.y + 200;
		}
		if (clipz) {
			clipz = clipz;
		} else {
			clipz = objbox.max.z + 200;
		}
		var sliderwidth = $('.xyz').width;
		$('.sliderx').val(objbox.max.x + 200);
		$('.sliderx').jRange({
			from: objbox.min.x - 200,
			to: objbox.max.x + 200,
			width: sliderwidth
		});
		$('.slidery').val(objbox.max.y + 200);
		$('.slidery').jRange({
			from: objbox.min.y - 200,
			to: objbox.max.y + 200,
			width: sliderwidth
		});
		$('.sliderz').val(objbox.max.z + 200);
		$('.sliderz').jRange({
			from: objbox.min.z - 200,
			to: objbox.max.z + 200,
			width: sliderwidth
		});
		clippingflag = true;
	}


}

function clippingModel(where) {
	ModelClip = !(ModelClip);
	if (!ModelClip) {
		if (!where) MeasureType = "none";
		document.getElementById("idBtnClipping").innerHTML = '<svg t="1678678041004" class="icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="16369" width="128" height="128"><path d="M184.09 694.77C117.88 694.77 64 640.49 64 573.75s53.88-121.03 120.09-121.03 120.09 54.3 120.09 121.03-53.87 121.02-120.09 121.02z m0-189.35c-37.16 0-67.39 30.65-67.39 68.33 0 37.67 30.23 68.32 67.39 68.32s67.39-30.65 67.39-68.32c0-37.68-30.23-68.33-67.39-68.33z" fill="#ffffff" p-id="16370"></path><path d="M914.33 600.1h-636.5c-14.55 0-26.35-11.8-26.35-26.35s11.8-26.35 26.35-26.35h636.5c14.55 0 26.35 11.8 26.35 26.35 0.01 14.55-11.79 26.35-26.35 26.35z" fill="#ffffff" p-id="16371"></path><path d="M914.33 600.1H492.42c-9.66 0-18.56-5.3-23.17-13.79a26.36 26.36 0 0 1 1.09-26.94c35.94-55.18 83.61-114.04 194.85-114.04 96.82 0 224.73 42.66 271.22 114.05 5.28 8.1 5.7 18.44 1.08 26.94a26.336 26.336 0 0 1-23.16 13.78z m-369.31-52.7H846.2c-47.56-28.78-118.29-49.37-181.01-49.37-56.84 0-90.96 17.1-120.17 49.37zM323.05 425.69c-6.95 0-13.95-0.6-20.94-1.84-31.71-5.59-59.32-23.31-77.75-49.9-37.85-54.59-24.63-130.13 29.46-168.39 26.24-18.56 58.08-25.73 89.68-20.15 31.69 5.59 59.31 23.31 77.75 49.9 37.86 54.59 24.64 130.14-29.45 168.39-20.46 14.46-44.29 21.99-68.75 21.99z m-0.38-189.4c-13.66 0-26.98 4.21-38.42 12.3-30.59 21.64-38.02 64.4-16.58 95.33 10.36 14.95 25.84 24.9 43.59 28.03 17.62 3.09 35.42-0.89 50.09-11.28 30.6-21.64 38.04-64.4 16.59-95.33-10.36-14.95-25.84-24.9-43.6-28.03-3.89-0.68-7.79-1.02-11.67-1.02z" fill="#ffffff" p-id="16372"></path><path d="M676.01 840.44c-8.35 0-16.56-3.95-21.68-11.34L354.91 397.2c-8.3-11.96-5.31-28.38 6.64-36.67 11.98-8.31 28.37-5.31 36.67 6.64l299.42 431.9c8.3 11.97 5.31 28.39-6.64 36.67-4.58 3.18-9.82 4.7-14.99 4.7z" fill="#ffffff" p-id="16373"></path><path d="M222.56 840.44h-52.71c-14.55 0-26.35-11.8-26.35-26.35s11.8-26.35 26.35-26.35h52.71c14.55 0 26.35 11.8 26.35 26.35s-11.8 26.35-26.35 26.35zM786.89 840.44h-94.06c-14.55 0-26.35-11.8-26.35-26.35s11.8-26.35 26.35-26.35h94.06c14.55 0 26.35 11.8 26.35 26.35s-11.8 26.35-26.35 26.35z m-188.11 0h-94.06c-14.55 0-26.35-11.8-26.35-26.35s11.8-26.35 26.35-26.35h94.06c14.55 0 26.35-11.8 26.35-26.35s-11.8 26.35-26.35 26.35z m-188.11 0h-94.06c-14.55 0-26.35-11.8-26.35-26.35s11.8-26.35 26.35-26.35h94.06c14.55 0 26.35-11.8 26.35-26.35s-11.8 26.35-26.35 26.35zM933.65 840.44h-52.71c-14.55 0-26.35-11.8-26.35-26.35s11.8-26.35 26.35-26.35h52.71c14.55 0 26.35 11.8 26.35 26.35s-11.8 26.35-26.35 26.35z" fill="#ffffff" p-id="16374"></path><path d="M675.99 840.44H560.86c-6.95 0-13.61-2.74-18.56-7.63-18.62-18.47-34.78-37.5-48-56.59-57.25-82.56-49.08-150.11-19.19-226.14a26.338 26.338 0 0 1 21.48-16.53c9.84-1.11 19.17 3.18 24.71 11.16l176.34 254.36c5.58 8.06 6.24 18.56 1.69 27.24a26.363 26.363 0 0 1-23.34 14.13zM571.9 787.73h53.75L508.47 618.71c-9.24 42.52-3.41 80.53 29.15 127.49 9.61 13.85 21.12 27.79 34.28 41.53z" fill="#ffffff" p-id="16375"></path></svg>';
	} else {
		document.getElementById("idBtnClipping").innerHTML = '<svg t="1678678041004" class="icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="16369" width="128" height="128"><path d="M184.09 694.77C117.88 694.77 64 640.49 64 573.75s53.88-121.03 120.09-121.03 120.09 54.3 120.09 121.03-53.87 121.02-120.09 121.02z m0-189.35c-37.16 0-67.39 30.65-67.39 68.33 0 37.67 30.23 68.32 67.39 68.32s67.39-30.65 67.39-68.32c0-37.68-30.23-68.33-67.39-68.33z" fill="#1296db" p-id="16370"></path><path d="M914.33 600.1h-636.5c-14.55 0-26.35-11.8-26.35-26.35s11.8-26.35 26.35-26.35h636.5c14.55 0 26.35 11.8 26.35 26.35 0.01 14.55-11.79 26.35-26.35 26.35z" fill="#1296db" p-id="16371"></path><path d="M914.33 600.1H492.42c-9.66 0-18.56-5.3-23.17-13.79a26.36 26.36 0 0 1 1.09-26.94c35.94-55.18 83.61-114.04 194.85-114.04 96.82 0 224.73 42.66 271.22 114.05 5.28 8.1 5.7 18.44 1.08 26.94a26.336 26.336 0 0 1-23.16 13.78z m-369.31-52.7H846.2c-47.56-28.78-118.29-49.37-181.01-49.37-56.84 0-90.96 17.1-120.17 49.37zM323.05 425.69c-6.95 0-13.95-0.6-20.94-1.84-31.71-5.59-59.32-23.31-77.75-49.9-37.85-54.59-24.63-130.13 29.46-168.39 26.24-18.56 58.08-25.73 89.68-20.15 31.69 5.59 59.31 23.31 77.75 49.9 37.86 54.59 24.64 130.14-29.45 168.39-20.46 14.46-44.29 21.99-68.75 21.99z m-0.38-189.4c-13.66 0-26.98 4.21-38.42 12.3-30.59 21.64-38.02 64.4-16.58 95.33 10.36 14.95 25.84 24.9 43.59 28.03 17.62 3.09 35.42-0.89 50.09-11.28 30.6-21.64 38.04-64.4 16.59-95.33-10.36-14.95-25.84-24.9-43.6-28.03-3.89-0.68-7.79-1.02-11.67-1.02z" fill="#1296db" p-id="16372"></path><path d="M676.01 840.44c-8.35 0-16.56-3.95-21.68-11.34L354.91 397.2c-8.3-11.96-5.31-28.38 6.64-36.67 11.98-8.31 28.37-5.31 36.67 6.64l299.42 431.9c8.3 11.97 5.31 28.39-6.64 36.67-4.58 3.18-9.82 4.7-14.99 4.7z" fill="#1296db" p-id="16373"></path><path d="M222.56 840.44h-52.71c-14.55 0-26.35-11.8-26.35-26.35s11.8-26.35 26.35-26.35h52.71c14.55 0 26.35 11.8 26.35 26.35s-11.8 26.35-26.35 26.35zM786.89 840.44h-94.06c-14.55 0-26.35-11.8-26.35-26.35s11.8-26.35 26.35-26.35h94.06c14.55 0 26.35 11.8 26.35 26.35s-11.8 26.35-26.35 26.35z m-188.11 0h-94.06c-14.55 0-26.35-11.8-26.35-26.35s11.8-26.35 26.35-26.35h94.06c14.55 0 26.35 11.8 26.35-26.35s-11.8 26.35-26.35 26.35z m-188.11 0h-94.06c-14.55 0-26.35-11.8-26.35-26.35s11.8-26.35 26.35-26.35h94.06c14.55 0 26.35-11.8 26.35-26.35s-11.8 26.35-26.35 26.35zM933.65 840.44h-52.71c-14.55 0-26.35-11.8-26.35-26.35s11.8-26.35 26.35-26.35h52.71c14.55 0 26.35 11.8 26.35 26.35s-11.8 26.35-26.35 26.35z" fill="#1296db" p-id="16374"></path><path d="M675.99 840.44H560.86c-6.95 0-13.61-2.74-18.56-7.63-18.62-18.47-34.78-37.5-48-56.59-57.25-82.56-49.08-150.11-19.19-226.14a26.338 26.338 0 0 1 21.48-16.53c9.84-1.11 19.17 3.18 24.71 11.16l176.34 254.36c5.58 8.06 6.24 18.56 1.69 27.24a26.363 26.363 0 0 1-23.34 14.13zM571.9 787.73h53.75L508.47 618.71c-9.24 42.52-3.41 80.53 29.15 127.49 9.61 13.85 21.12 27.79 34.28 41.53z" fill="#1296db" p-id="16375"></path></svg>';
		if (RotatePlay) rotatePlay("none");
		if (AnglePoint) anglePoints("none");
		if (LabelPoint) labelPoint("none");
		if (SelectPart) changeSelectPart("none");
		if (DistancePoint) distancePoints("none");
	}
}




function initstlfiles(reset = false) {
	var oDiv = document.getElementById("div_stlfiles");
	var oUL = document.getElementById("stlfiles");
	var oLis = oUL.getElementsByTagName("li");
	var oClose = $(".closeAllopacity").children(".stlname");
	var closeType = "all-open";
	if (oClose.text() == '全部关闭') {
		oClose.text('全部显示');
		closeType = "all-close";
	} else {
		oClose.text('全部关闭');
	}
	if (reset) return;
	//从第二个开始i=1开始
	for (var i = 1; i < oLis.length; i++) {

		var objectnum = oLis[i].getAttribute('objectnum');
		
		if (objectnum) {
			setvisible(null, objectnum, closeType);
		}
	}
}

function popupFunctionWindow() {
	$(".popup").show();
}

function openAllPart() {

	var oDiv = document.getElementById("div_stlfiles");
	var oUL = document.getElementById("stlfiles");
	var oLis = oUL.getElementsByTagName("li");

	var bselectMesh = false;
	if (SelectPart) {

		for (var i = 0; i < stlfiles.length; i++) {
			if (stlfiles[i].selected == true) {

				//只打开这个
				bselectMesh = true;
				break;
			}
		}

		if ((oDiv.style.display == "")) {
			if (bselectMesh) {
				oDiv.style.display = "";
				oUL.style.display = "";
				for (var i = 0; i < oLis.length; i++) {
					oLis[i].style.display = "";
				}
			}
			else {
				oDiv.style.display = "none";
				oUL.style.display = "none";
				for (var i = 0; i < oLis.length; i++) {
					oLis[i].style.display = "none";
				}
			}
		}
		else {
			oDiv.style.display = "";
			oUL.style.display = "";
			for (var i = 0; i < oLis.length; i++) {
				oLis[i].style.display = "";
			}
		}
	}
	else {
		if (oDiv.style.display == "") {
			oDiv.style.display = "none";
			oUL.style.display = "none";
			for (var i = 0; i < oLis.length; i++) {
				oLis[i].style.display = "none";
			}
		}
		else {
			oDiv.style.display = "";
			oUL.style.display = "";
			$('.stlfiles').children().filter('[data-cate="' + mainCateId + '"]').show();
		}
	}

	if (SelectPart) {
		changeSelectPart();
	}

}

function openAllTool() {
	$('.tools-container').fadeToggle('fast', function () {
		if ($('.tools-container').css('display') == 'none') {
			$('#menua').animate({ top: 5 });
		} else {
			$('#menua').animate({ top: ($('.tools-container').height() + 10) });
		}
	});
}

function rotatePlay(where) {
	RotatePlay = !(RotatePlay);
	if (!RotatePlay) {
		if (!where) MeasureType = "none";
		document.getElementById("idRotatePlay").innerHTML = '<svg t="1660559415125" class="icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="12361" width="128" height="128"><path d="M512 85.333333a426.666667 426.666667 0 1 0 426.666667 426.666667A426.666667 426.666667 0 0 0 512 85.333333z m0 768a341.333333 341.333333 0 1 1 341.333333-341.333333 341.333333 341.333333 0 0 1-341.333333 341.333333zM433.066667 329.386667A32 32 0 0 0 384 356.266667v311.466666a32 32 0 0 0 49.066667 26.88L682.666667 539.306667a32.426667 32.426667 0 0 0 0-54.613334z" p-id="12362" fill="#ffffff"></path></svg>';
	} else {
		document.getElementById("idRotatePlay").innerHTML = '<svg t="1660559415125" class="icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="12361" width="128" height="128"><path d="M512 85.333333a426.666667 426.666667 0 1 0 426.666667 426.666667A426.666667 426.666667 0 0 0 512 85.333333z m0 768a341.333333 341.333333 0 1 1 341.333333-341.333333 341.333333 341.333333 0 0 1-341.333333 341.333333zM433.066667 329.386667A32 32 0 0 0 384 356.266667v311.466666a32 32 0 0 0 49.066667 26.88L682.666667 539.306667a32.426667 32.426667 0 0 0 0-54.613334z" p-id="12362" fill="#1296db"></path></svg>';
		if (AnglePoint) anglePoints("none");
		if (LabelPoint) labelPoint("none");
		if (SelectPart) changeSelectPart("none");
		if (DistancePoint) distancePoints("none");
		if (ModelClip) clippingModel("none");
	}
}

function rotateLock() {
	RotateLock += 5;
	if (RotateLock > 30) {
		RotateLock = 0;
	}
	$("#rotateLockAngle").text(RotateLock);
}

function distancePoints(where) {
	DistancePoint = !(DistancePoint);
	if (!DistancePoint) {
		if (!where) MeasureType = "none";
		document.getElementById("idBtnDistance").innerHTML = '<svg t="1660010231000" class="icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="12644" width="128" height="128"><path d="M926.293333 247.893333l-150.186666-150.186666a42.666667 42.666667 0 0 0-29.866667-12.373334h-31.146667a42.666667 42.666667 0 0 0-30.293333 12.373334L97.706667 684.8a42.666667 42.666667 0 0 0-12.373334 30.293333v31.146667a42.666667 42.666667 0 0 0 12.373334 29.866667l150.186666 150.186666a42.666667 42.666667 0 0 0 29.866667 12.373334h31.146667a42.666667 42.666667 0 0 0 32.426666-12.373334L926.293333 341.333333a42.666667 42.666667 0 0 0 12.373334-32.426666v-31.146667a42.666667 42.666667 0 0 0-12.373334-29.866667zM293.546667 853.333333l-120.746667-122.88 42.666667-40.533333 45.226666 45.226667a21.333333 21.333333 0 0 0 29.866667 0l23.04-23.04a21.333333 21.333333 0 0 0 0-29.866667l-46.933333-45.226667 52.906666-52.906666 23.893334 23.893333a21.333333 21.333333 0 0 0 29.866666 0l23.04-23.04a21.333333 21.333333 0 0 0 0-29.866667l-23.893333-23.893333L426.666667 478.293333l42.666666 45.226667a21.333333 21.333333 0 0 0 29.866667 0l23.04-23.04a21.333333 21.333333 0 0 0 0-29.866667L478.293333 426.666667l52.906667-52.906667 23.893333 23.893333a21.333333 21.333333 0 0 0 29.866667 0l23.04-23.04a21.333333 21.333333 0 0 0 0-29.866666l-23.893333-23.893334 52.906666-52.906666L682.666667 311.893333a21.333333 21.333333 0 0 0 29.866666 0l23.04-23.04a21.333333 21.333333 0 0 0 0-29.866666L689.92 213.333333l40.533333-42.666666L853.333333 293.546667z" p-id="12645" fill="#ffffff"></path></svg>';
	} else {
		MeasureType = "distance";
		document.getElementById("idBtnDistance").innerHTML = '<svg t="1660010231000" class="icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="12644" width="128" height="128"><path d="M926.293333 247.893333l-150.186666-150.186666a42.666667 42.666667 0 0 0-29.866667-12.373334h-31.146667a42.666667 42.666667 0 0 0-30.293333 12.373334L97.706667 684.8a42.666667 42.666667 0 0 0-12.373334 30.293333v31.146667a42.666667 42.666667 0 0 0 12.373334 29.866667l150.186666 150.186666a42.666667 42.666667 0 0 0 29.866667 12.373334h31.146667a42.666667 42.666667 0 0 0 32.426666-12.373334L926.293333 341.333333a42.666667 42.666667 0 0 0 12.373334-32.426666v-31.146667a42.666667 42.666667 0 0 0-12.373334-29.866667zM293.546667 853.333333l-120.746667-122.88 42.666667-40.533333 45.226666 45.226667a21.333333 21.333333 0 0 0 29.866667 0l23.04-23.04a21.333333 21.333333 0 0 0 0-29.866667l-46.933333-45.226667 52.906666-52.906666 23.893334 23.893333a21.333333 21.333333 0 0 0 29.866666 0l23.04-23.04a21.333333 21.333333 0 0 0 0-29.866667l-23.893333-23.893333L426.666667 478.293333l42.666666 45.226667a21.333333 21.333333 0 0 0 29.866667 0l23.04-23.04a21.333333 21.333333 0 0 0 0-29.866667L478.293333 426.666667l52.906667-52.906667 23.893333 23.893333a21.333333 21.333333 0 0 0 29.866667 0l23.04-23.04a21.333333 21.333333 0 0 0 0-29.866666l-23.893333-23.893334 52.906666-52.906666L682.666667 311.893333a21.333333 21.333333 0 0 0 29.866666 0l23.04-23.04a21.333333 21.333333 0 0 0 0-29.866666L689.92 213.333333l40.533333-42.666666L853.333333 293.546667z" p-id="12645" fill="#1296db""></path></svg>';
		if (AnglePoint) anglePoints("none");
		if (LabelPoint) labelPoint("none");
		if (SelectPart) changeSelectPart("none");
		if (RotatePlay) rotatePlay("none");
		if (ModelClip) clippingModel("none");
	}
}

function anglePoints(where) {
	AnglePoint = !(AnglePoint);
	if (!AnglePoint) {
		if (!where) MeasureType = "none";
		document.getElementById("idBtnAngle").innerHTML = '<svg t="1660011172577" class="icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="12822" width="128" height="128"><path d="M469.333333 192.853333v-42.666666a21.333333 21.333333 0 0 1 6.826667-15.36 23.466667 23.466667 0 0 1 15.786667-6.826667A426.666667 426.666667 0 0 1 896 532.053333a23.466667 23.466667 0 0 1-5.973333 15.786667 21.333333 21.333333 0 0 1-15.36 6.826667h-42.666667a20.906667 20.906667 0 0 1-20.906667-20.053334A341.333333 341.333333 0 0 0 489.386667 213.333333a20.906667 20.906667 0 0 1-20.053334-20.48zM874.666667 640h-42.666667a21.333333 21.333333 0 0 0-21.333333 21.333333V810.666667H213.333333V213.333333h149.333334a21.333333 21.333333 0 0 0 21.333333-21.333333v-42.666667a21.333333 21.333333 0 0 0-21.333333-21.333333H213.333333a85.333333 85.333333 0 0 0-85.333333 85.333333v597.333334a85.333333 85.333333 0 0 0 85.333333 85.333333h597.333334a85.333333 85.333333 0 0 0 85.333333-85.333333v-149.333334a21.333333 21.333333 0 0 0-21.333333-21.333333z m-384-42.666667a64 64 0 1 0-64-64 64 64 0 0 0 64 64z" p-id="12823" fill="#ffffff"></path></svg>';
	} else {
		MeasureType = "angle";
		document.getElementById("idBtnAngle").innerHTML = '<svg t="1660011172577" class="icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="12822" width="128" height="128"><path d="M469.333333 192.853333v-42.666666a21.333333 21.333333 0 0 1 6.826667-15.36 23.466667 23.466667 0 0 1 15.786667-6.826667A426.666667 426.666667 0 0 1 896 532.053333a23.466667 23.466667 0 0 1-5.973333 15.786667 21.333333 21.333333 0 0 1-15.36 6.826667h-42.666667a20.906667 20.906667 0 0 1-20.906667-20.053334A341.333333 341.333333 0 0 0 489.386667 213.333333a20.906667 20.906667 0 0 1-20.053334-20.48zM874.666667 640h-42.666667a21.333333 21.333333 0 0 0-21.333333 21.333333V810.666667H213.333333V213.333333h149.333334a21.333333 21.333333 0 0 0 21.333333-21.333333v-42.666667a21.333333 21.333333 0 0 0-21.333333-21.333333H213.333333a85.333333 85.333333 0 0 0-85.333333 85.333333v597.333334a85.333333 85.333333 0 0 0 85.333333 85.333333h597.333334a85.333333 85.333333 0 0 0 85.333333-85.333333v-149.333334a21.333333 21.333333 0 0 0-21.333333-21.333333z m-384-42.666667a64 64 0 1 0-64-64 64 64 0 0 0 64 64z" p-id="12823" fill="#1296db"></path></svg>';
		if (DistancePoint) distancePoints("none");
		if (LabelPoint) labelPoint("none");
		if (SelectPart) changeSelectPart("none");
		if (RotatePlay) rotatePlay("none");
		if (ModelClip) clippingModel("none");
	}
}

function labelPoint(where) {
	LabelPoint = !(LabelPoint);
	if (!LabelPoint) {
		if (!where) MeasureType = "none";
		document.getElementById("idBtnLabel").innerHTML = '<svg t="1660011296886" class="icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="13008" width="128" height="128"><path d="M883.626667 145.493333l-5.12-5.12a44.8 44.8 0 0 0-30.293334-12.373333h-339.2a85.333333 85.333333 0 0 0-60.586666 25.173333l-308.053334 308.053334a42.666667 42.666667 0 0 0 0 60.16l362.24 362.24a42.666667 42.666667 0 0 0 60.16 0l308.053334-308.053334a85.333333 85.333333 0 0 0 25.173333-60.586666V175.786667a44.8 44.8 0 0 0-12.373333-30.293334zM682.666667 426.666667a85.333333 85.333333 0 1 1 85.333333-85.333334 85.333333 85.333333 0 0 1-85.333333 85.333334z" p-id="13009" fill="#ffffff"></path></svg>';
	} else {
		MeasureType = "label";
		document.getElementById("idBtnLabel").innerHTML = '<svg t="1660011296886" class="icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="13008" width="128" height="128"><path d="M883.626667 145.493333l-5.12-5.12a44.8 44.8 0 0 0-30.293334-12.373333h-339.2a85.333333 85.333333 0 0 0-60.586666 25.173333l-308.053334 308.053334a42.666667 42.666667 0 0 0 0 60.16l362.24 362.24a42.666667 42.666667 0 0 0 60.16 0l308.053334-308.053334a85.333333 85.333333 0 0 0 25.173333-60.586666V175.786667a44.8 44.8 0 0 0-12.373333-30.293334zM682.666667 426.666667a85.333333 85.333333 0 1 1 85.333333-85.333334 85.333333 85.333333 0 0 1-85.333333 85.333334z" p-id="13009" fill="#1296db"></path></svg>';
		if (DistancePoint) distancePoints("none");
		if (AnglePoint) anglePoints("none");
		if (SelectPart) changeSelectPart("none");
		if (RotatePlay) rotatePlay("none");
		if (ModelClip) clippingModel("none");
	}
}

function deleteItem() {
	var intersected = needDeleteTag.object;
	var index = intersected.uuid;

	var deleteMeasureObj = measureObj.get(index);

	for (var i = 0; i < deleteMeasureObj.pointsIndex.length; i++) {
		var idx = deleteMeasureObj.pointsIndex[i];
		var deletePoint = drawPoints.get(idx);
		scene.remove(deletePoint);
		drawPoints.delete(idx);
	}
	for (var i = 0; i < deleteMeasureObj.linesIndex.length; i++) {
		var idx = deleteMeasureObj.linesIndex[i];
		var deleteLine = drawLines.get(idx);
		scene.remove(deleteLine);
		drawLines.delete(idx);
	}
	for (var i = 0; i < deleteMeasureObj.textsIndex.length; i++) {
		var idx = deleteMeasureObj.textsIndex[i];
		var deleteText = drawTexts.get(idx);
		scene.remove(deleteText);
		drawTexts.delete(idx);
	}
	measureObj.delete(index);
}


function changeSelectPart(where) {
	SelectPart = !(SelectPart);
	var oDiv = document.getElementById("div_stlfiles");
	var oUL = document.getElementById("stlfiles");
	var oLis = oUL.getElementsByTagName("li");

	if (SelectPart != true) {
		if (!where) MeasureType = "none";
		for (var i = 0; i < stlfiles.length; i++) {
			stlfiles[i].selected = false;
		}
		document.getElementById("idSelectPart").innerHTML = '<svg t="1659978961773" class="icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="12320" width="128" height="128"><path d="M384 490.666667v42.666666a21.333333 21.333333 0 0 1-21.333333 21.333334H256v85.333333a21.333333 21.333333 0 0 1-36.266667 14.933333l-128-128a21.76 21.76 0 0 1 0-30.293333l128-128A21.333333 21.333333 0 0 1 256 384v85.333333h106.666667a21.333333 21.333333 0 0 1 21.333333 21.333334zM384 256h85.333333v106.666667a21.333333 21.333333 0 0 0 21.333334 21.333333h42.666666a21.333333 21.333333 0 0 0 21.333334-21.333333V256h85.333333a21.333333 21.333333 0 0 0 15.36-36.266667l-128-128a21.76 21.76 0 0 0-30.293333 0l-128 128A21.333333 21.333333 0 0 0 384 256z m256 512h-85.333333v-106.666667a21.333333 21.333333 0 0 0-21.333334-21.333333h-42.666666a21.333333 21.333333 0 0 0-21.333334 21.333333V768H384a21.333333 21.333333 0 0 0-14.933333 36.266667l128 128a21.76 21.76 0 0 0 30.293333 0l128-128A21.333333 21.333333 0 0 0 640 768z m292.693333-270.933333l-128-128A21.333333 21.333333 0 0 0 768 384v85.333333h-106.666667a21.333333 21.333333 0 0 0-21.333333 21.333334v42.666666a21.333333 21.333333 0 0 0 21.333333 21.333334H768v85.333333a21.333333 21.333333 0 0 0 36.266667 14.933333l128-128a21.76 21.76 0 0 0 0.426666-29.866666z" p-id="12321" fill="#ffffff"></path></svg>';
		for (var i = 0; i < oLis.length; i++) {
			oLis[0].style.display = "";
			if (in_array(oLis[i].getAttribute('data-cate'), cateselectid)) {
				oLis[i].style.display = "";
			}
		}
	} else {
		MeasureType = "select";
		document.getElementById("idSelectPart").innerHTML = '<svg t="1659978961773" class="icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="12320" width="128" height="128"><path d="M384 490.666667v42.666666a21.333333 21.333333 0 0 1-21.333333 21.333334H256v85.333333a21.333333 21.333333 0 0 1-36.266667 14.933333l-128-128a21.76 21.76 0 0 1 0-30.293333l128-128A21.333333 21.333333 0 0 1 256 384v85.333333h106.666667a21.333333 21.333333 0 0 1 21.333333 21.333334zM384 256h85.333333v106.666667a21.333333 21.333333 0 0 0 21.333334 21.333333h42.666666a21.333333 21.333333 0 0 0 21.333334-21.333333V256h85.333333a21.333333 21.333333 0 0 0 15.36-36.266667l-128-128a21.76 21.76 0 0 0-30.293333 0l-128 128A21.333333 21.333333 0 0 0 384 256z m256 512h-85.333333v-106.666667a21.333333 21.333333 0 0 0-21.333334-21.333333h-42.666666a21.333333 21.333333 0 0 0-21.333334 21.333333V768H384a21.333333 21.333333 0 0 0-14.933333 36.266667l128 128a21.76 21.76 0 0 0 30.293333 0l128-128A21.333333 21.333333 0 0 0 640 768z m292.693333-270.933333l-128-128A21.333333 21.333333 0 0 0 768 384v85.333333h-106.666667a21.333333 21.333333 0 0 0-21.333333 21.333334v42.666666a21.333333 21.333333 0 0 0 21.333333 21.333334H768v85.333333a21.333333 21.333333 0 0 0 36.266667 14.933333l128-128a21.76 21.76 0 0 0 0.426666-29.866666z" p-id="12321" fill="#1296db"></path></svg>';
		if (AnglePoint) anglePoints("none");
		if (LabelPoint) labelPoint("none");
		if (DistancePoint) distancePoints("none");
		if (RotatePlay) rotatePlay("none");
		if (ModelClip) clippingModel("none");
	}
}

function reinitCamera() {
	initstlfiles(true);
	controls.reset();
	adjustCameraAuto(true);
}

function setColor(objectnum, color) {
	stlfiles[meshloadindex[objectnum]].filecolor = color;
}

function setopacity(objectnum) {

	var iOpacity = document.getElementById("opacity" + objectnum).getAttribute('opacity');

	if (userId == 1) {
		if ((iOpacity >= 0) && (iOpacity < 25)) {
			iOpacity = 25;
		}
		else {
			if ((iOpacity >= 25) && (iOpacity < 50)) {
				iOpacity = 50;
			} else if ((iOpacity >= 50) && (iOpacity < 100)) {
				iOpacity = 100;
			} else {
				if (iOpacity >= 100) {
					iOpacity = 0;
				}
			}
		}
	}else if(userId == 5){
	    if ((iOpacity >= 0) && (iOpacity < 25)) {
			iOpacity = 25;
		}
		else {
			if ((iOpacity >= 25) && (iOpacity < 40)) {
				iOpacity = 40;
			} else if ((iOpacity >= 40) && (iOpacity < 100)) {
				iOpacity = 100;
			} else {
				if (iOpacity >= 100) {
					iOpacity = 0;
				}
			}
		}
	}else if(userId == 18){
	    if ((iOpacity >= 0) && (iOpacity < 25)) {
			iOpacity = 25;
		}
		else {
			if ((iOpacity >= 25) && (iOpacity < 50)) {
				iOpacity = 50;
			} else if ((iOpacity >= 50) && (iOpacity < 75)) {
				iOpacity = 75;
			} else if ((iOpacity >= 75) && (iOpacity < 100)) {
				iOpacity = 100;
			} else {
				if (iOpacity >= 100) {
					iOpacity = 0;
				}
			}
		}
	}else {
		if ((iOpacity >= 0) && (iOpacity < 25)) {
			iOpacity = 25;
		}
		else {
			if ((iOpacity >= 25) && (iOpacity < 100)) {
				iOpacity = 100;
			} else {
				if (iOpacity >= 100) {
					iOpacity = 0;
				}
			}
		}
	}

	document.getElementById("opacity" + objectnum).setAttribute('opacity', iOpacity);
	document.getElementById("opacity" + objectnum).innerText = '透明度 ' + iOpacity + '%';
	stlfiles[meshloadindex[objectnum]].opacity = iOpacity / 100;

	if (iOpacity <= 100) {
		iOpacity = 100; //调整按钮透明度，以免看不见
	}
	//document.getElementById("stlfile"+objectnum).style.filter = 'alpha(opacity:'+iOpacity+')'; //设置IE的透明度
	//document.getElementById("stlfile"+objectnum).style.opacity = iOpacity / 100; //设置fierfox等透明度，注意透明度值是小数

	var tmpColor = document.getElementById("stlfile" + objectnum).getAttribute('oldbackground');
	// document.getElementById("stlfile" + objectnum).style.background = hexToRgba(tmpColor, iOpacity / 100);

}

function setvisible(e, objectnum, type = 'one') {
	if (type == 'all-open') {
		document.getElementById("show" + objectnum).innerHTML = '<svg t="1689484687001" class="icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="3050" width="20" height="20"><path d="M942.2 486.2C847.4 286.5 704.1 186 512 186c-192.2 0-335.4 100.5-430.2 300.3-7.7 16.2-7.7 35.2 0 51.5C176.6 737.5 319.9 838 512 838c192.2 0 335.4-100.5 430.2-300.3 7.7-16.2 7.7-35 0-51.5zM512 766c-161.3 0-279.4-81.8-362.7-254C232.6 339.8 350.7 258 512 258c161.3 0 279.4 81.8 362.7 254C791.5 684.2 673.4 766 512 766z" p-id="3051" fill="#e6e6e6"></path><path d="M508 336c-97.2 0-176 78.8-176 176s78.8 176 176 176 176-78.8 176-176-78.8-176-176-176z m0 288c-61.9 0-112-50.1-112-112s50.1-112 112-112 112 50.1 112 112-50.1 112-112 112z" p-id="3052" fill="#e6e6e6"></path></svg>';
		stlfiles[meshloadindex[objectnum]].visible = true;
		return;
	} else if (type == 'all-close') {
		document.getElementById("show" + objectnum).innerHTML = '<svg t="1689484169737" class="icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="2615" width="20" height="20"><path d="M942.3 486.4l-0.1-0.1-0.1-0.1c-36.4-76.7-80-138.7-130.7-186L760.7 351c43.7 40.2 81.5 93.7 114.1 160.9C791.5 684.2 673.4 766 512 766c-51.3 0-98.3-8.3-141.2-25.1l-54.7 54.7C374.6 823.8 439.8 838 512 838c192.2 0 335.4-100.5 430.2-300.3 7.7-16.2 7.7-35 0.1-51.3z m-64-332.2l-42.4-42.4c-3.1-3.1-8.2-3.1-11.3 0L707.8 228.5C649.4 200.2 584.2 186 512 186c-192.2 0-335.4 100.5-430.2 300.3v0.1c-7.7 16.2-7.7 35.2 0 51.5 36.4 76.7 80 138.7 130.7 186.1L111.8 824.5c-3.1 3.1-3.1 8.2 0 11.3l42.4 42.4c3.1 3.1 8.2 3.1 11.3 0l712.8-712.8c3.1-3 3.1-8.1 0-11.2zM398.9 537.4c-1.9-8.2-2.9-16.7-2.9-25.4 0-61.9 50.1-112 112-112 8.7 0 17.3 1 25.4 2.9L398.9 537.4z m184.5-184.5C560.5 342.1 535 336 508 336c-97.2 0-176 78.8-176 176 0 27 6.1 52.5 16.9 75.4L263.3 673c-43.7-40.2-81.5-93.7-114.1-160.9C232.6 339.8 350.7 258 512 258c51.3 0 98.3 8.3 141.2 25.1l-69.8 69.8z" p-id="2616" fill="#e6e6e6"></path><path d="M508 624c-6.4 0-12.7-0.5-18.8-1.6l-51.1 51.1c21.4 9.3 45.1 14.4 69.9 14.4 97.2 0 176-78.8 176-176 0-24.8-5.1-48.5-14.4-69.9l-51.1 51.1c1 6.1 1.6 12.4 1.6 18.8C620 573.9 569.9 624 508 624z" p-id="2617" fill="#e6e6e6"></path></svg>';
		stlfiles[meshloadindex[objectnum]].visible = false;
		return;
	}
	if (stlfiles[meshloadindex[objectnum]].visible) {
		document.getElementById("show" + objectnum).innerHTML = '<svg t="1689484169737" class="icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="2615" width="20" height="20"><path d="M942.3 486.4l-0.1-0.1-0.1-0.1c-36.4-76.7-80-138.7-130.7-186L760.7 351c43.7 40.2 81.5 93.7 114.1 160.9C791.5 684.2 673.4 766 512 766c-51.3 0-98.3-8.3-141.2-25.1l-54.7 54.7C374.6 823.8 439.8 838 512 838c192.2 0 335.4-100.5 430.2-300.3 7.7-16.2 7.7-35 0.1-51.3z m-64-332.2l-42.4-42.4c-3.1-3.1-8.2-3.1-11.3 0L707.8 228.5C649.4 200.2 584.2 186 512 186c-192.2 0-335.4 100.5-430.2 300.3v0.1c-7.7 16.2-7.7 35.2 0 51.5 36.4 76.7 80 138.7 130.7 186.1L111.8 824.5c-3.1 3.1-3.1 8.2 0 11.3l42.4 42.4c3.1 3.1 8.2 3.1 11.3 0l712.8-712.8c3.1-3 3.1-8.1 0-11.2zM398.9 537.4c-1.9-8.2-2.9-16.7-2.9-25.4 0-61.9 50.1-112 112-112 8.7 0 17.3 1 25.4 2.9L398.9 537.4z m184.5-184.5C560.5 342.1 535 336 508 336c-97.2 0-176 78.8-176 176 0 27 6.1 52.5 16.9 75.4L263.3 673c-43.7-40.2-81.5-93.7-114.1-160.9C232.6 339.8 350.7 258 512 258c51.3 0 98.3 8.3 141.2 25.1l-69.8 69.8z" p-id="2616" fill="#e6e6e6"></path><path d="M508 624c-6.4 0-12.7-0.5-18.8-1.6l-51.1 51.1c21.4 9.3 45.1 14.4 69.9 14.4 97.2 0 176-78.8 176-176 0-24.8-5.1-48.5-14.4-69.9l-51.1 51.1c1 6.1 1.6 12.4 1.6 18.8C620 573.9 569.9 624 508 624z" p-id="2617" fill="#e6e6e6"></path></svg>';
		stlfiles[meshloadindex[objectnum]].visible = false;
	} else {
		document.getElementById("show" + objectnum).innerHTML = '<svg t="1689484687001" class="icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="3050" width="20" height="20"><path d="M942.2 486.2C847.4 286.5 704.1 186 512 186c-192.2 0-335.4 100.5-430.2 300.3-7.7 16.2-7.7 35.2 0 51.5C176.6 737.5 319.9 838 512 838c192.2 0 335.4-100.5 430.2-300.3 7.7-16.2 7.7-35 0-51.5zM512 766c-161.3 0-279.4-81.8-362.7-254C232.6 339.8 350.7 258 512 258c161.3 0 279.4 81.8 362.7 254C791.5 684.2 673.4 766 512 766z" p-id="3051" fill="#e6e6e6"></path><path d="M508 336c-97.2 0-176 78.8-176 176s78.8 176 176 176 176-78.8 176-176-78.8-176-176-176z m0 288c-61.9 0-112-50.1-112-112s50.1-112 112-112 112 50.1 112 112-50.1 112-112 112z" p-id="3052" fill="#e6e6e6"></path></svg>';
		stlfiles[meshloadindex[objectnum]].visible = true;
	}
	timeRender();
}

let screenshots = {};
let texts = {};
let varPool = {};

function onNeedGenerateReport() {
	console.log('加载完毕，可生成报告');
	//获取模板图片规则
	$.post("/?s=App.Report.GetTemplateRules", {
		id: GetQueryString("template_id")
	}, function (data, status) {
		const { image_rule, text_rule } = data.data;
		if (status == 'success') {
			captureScreenshots(image_rule, 0, text_rule);
		}
	});
}

function adjustSceneToScreenshot(rule) {
    if(rule.invisible){
    	for (var i = 0; i < stlfiles.length; i++) {
    		stlfiles[i].visible = !in_array(stlfiles[i].stlname, rule.invisible);
    	}
    }else if(rule.visible){
        for (var i = 0; i < stlfiles.length; i++) {
    		stlfiles[i].visible = in_array(stlfiles[i].stlname, rule.visible);
    	}
    }
	if(rule.side !== undefined){
		setCameraLookAtSide(rule.side);
	}
	camera.zoom = rule.scale;
	camera.updateProjectionMatrix();
	timeRender();
}

function captureScreenshots(rules, index, textRules) {
	if (index >= rules.length) {
		processTextRules(textRules); // 截图任务完成后开始处理文本数据
		return;
	}

	adjustSceneToScreenshot(rules[index]);
	setTimeout(() => {
		renderer.render(scene, camera);
		const imgData = renderer.domElement.toDataURL('image/png');
		//const base64Data = imgData.split(',')[1];
		addScreenshot(imgData, rules, index + 1, textRules);
	}, 100); // 延时确保渲染完成
}

function addScreenshot(base64Data, rules, nextIndex, textRules) {
	const slot = rules[nextIndex - 1].slot;
	screenshots[slot] = base64Data;
	setTimeout(() => captureScreenshots(rules, nextIndex, textRules), 100);
}

function processTextRules(rules) {
	//生成变量池
	rules.forEach(rule => {
		const slot = rule.slot;
		if (slot.startsWith('VAR_')) {
			const action = rule.action;
			const value = getValueByAction(rule, action);
			varPool[slot] = value;
		}
	});
	//使用变量池
	rules.forEach(rule => {
		const slot = rule.slot;
		if (!slot.startsWith('VAR_')) {
			const part = varText(rule.part);
			const value = getReportTextValue(slot, part);
			texts[slot] = value;
		}
	})
	//合并变量池
	texts = {...texts, ...varPool};
	console.log("texts", texts);
	const customImages = JSON.parse(sessionStorage.getItem('customImages') || '{}')
	for (let key in customImages) {
		screenshots[key] = customImages[key];
	}
	const customFields = JSON.parse(sessionStorage.getItem('customFields') || '{}')
	for (let key in customFields) {
		texts[key] = customFields[key];
	}
	completeScreenshotTask(); // 文本数据处理完毕后创建报告
}

function completeScreenshotTask() {
	//创建报告（截图和文本数据）
	$.post("/?s=App.Report.CreateNewReport", {
		order_no: GetQueryString("order_no"),
		template_id: GetQueryString("template_id"),
		screenshots: JSON.stringify(screenshots),
		texts: JSON.stringify(texts)
	}, function (data, status) {
		if (status == "success") {
			const { id } = data.data;
			//返回报告ID
			location.href = './../report/preview.html?id=' + id + '&name=' + patientName;
		}
	});
}

function varText(name) {
	if (name.startsWith('$')) {
		return varPool[name.substring(1)];
	} else {
		return name;
	}
}

function getReportTextValue(slot, part) {
	switch (slot) {
		case 'VOLUME':
			return getVolumeByPartName(part);
		case 'SIZE_MM':
			return getModelSizeByPartName(part, 'mm');
		case 'SIZE_CM':
			return getModelSizeByPartName(part, 'cm');
		//引用变量，原路返回
		default:
			return slot.startsWith('$') ? slot : '';
	}
}

function getValueByAction(rule, action) {
	switch (action) {
		case 'INDEX':
			return findRequiredPart(rule.of)
		default:
			return 'NULL';
	}
}

function findRequiredPart(parts) {
	for (let i = 0; i < stlfiles.length; i++) {
		for (let j = 0; j < parts.length; j++) {
			if (stlfiles[i].stlname == parts[j]) {
				return stlfiles[i].stlname;
			}
		}
	}
	return 'NULL';
}

function getVolumeByPartName(part) {
	for (let i = 0; i < stlfiles.length; i++) {
		if (stlfiles[i].stlname == part) {
			return stlfiles[i].volume.replace("ml", "");
		}
	}
	return '0.00';
}

function getModelSizeByPartName(part, unit) {
	for (let i = 0; i < meshobjects.length; i++) {
		if (meshobjects[i].name == part) {
			const geometry = meshobjects[i].geometry;
			if (!geometry.boundingBox) {
				geometry.computeBoundingBox();
			}
			const boundingBox = geometry.boundingBox;
			const min = boundingBox.min;
			const max = boundingBox.max;
			const dimensions = new THREE.Vector3().subVectors(max, min);
			const longest = Math.max(dimensions.x, dimensions.y, dimensions.z);
			const shortest = Math.min(dimensions.x, dimensions.y, dimensions.z);
			if (unit == 'mm') {
				return shortest.toFixed(2) + '*' + longest.toFixed(2);
			} else if (unit == 'cm') {
				return (shortest / 10).toFixed(1) + '*' + (longest / 10).toFixed(1);
			}
		}
	}
	return '0.00*0.00';
}

function colorRGB2Hex(color) {
	var rgb = color.split(',');
	var r = parseInt(rgb[0]);
	var g = parseInt(rgb[1]);
	var b = parseInt(rgb[2]);
	var hex = "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
	return hex;
}

// var sHex = '#ff008b';
// console.log('十六进制格式：', sHex);
// console.log('RGB格式：', hexToRgb(sHex));
// console.log('RGBA格式：', hexToRgba(sHex, 0.5));

//hex -> rgb
function hexToRgb(hex) {
	return 'rgb(' + parseInt('0x' + hex.slice(1, 3)) + ',' + parseInt('0x' + hex.slice(3, 5)) +
		',' + parseInt('0x' + hex.slice(5, 7)) + ')';
}

//hex -> rgba
function hexToRgba(hex, opacity) {
	return 'rgba(' + parseInt('0x' + hex.slice(1, 3)) + ',' + parseInt('0x' + hex.slice(3, 5)) + ',' +
		parseInt('0x' + hex.slice(5, 7)) + ',' + opacity + ')';
}

function contains(a, obj) {
	var i = a.length;
	while (i--) {
		if (a[i] === obj) {
			a.splice(i, 1)
			return i;
		}
	}
	return false;
}
function in_array(search, array) {
	for (var i in array) {
		if (array[i] == search) {
			return true;
		}
	}
	return false;
}


function attr(property, value) {
	// console.log(property,value)
	//两个参数
	if (value != undefined) {
		obj[property] = value;
	} else if (typeof property === 'object') {
		//批量设置属性   {src:'images/3.jpg',alt:'hello',title:'world'}
		//遍历属性对象
		for (var i in property) {
			// console.log(i,property[i]);
			obj[i] = property[i];
		}
	} else {
		//取出属性值
		console.log(obj.getAttribute(property));
	}

}