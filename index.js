var PIXI_APP = null;

var ELEMENT_TREE = {};

function calculateBounds(elements) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    
    function processElement(element) {
        // Process current element
        const left = parseFloat(element.position_global.left);
        const top = parseFloat(element.position_global.top);
        const right = parseFloat(element.position_global.right);
        const bottom = parseFloat(element.position_global.bottom);
        
        minX = Math.min(minX, left);
        minY = Math.min(minY, top);
        maxX = Math.max(maxX, right);
        maxY = Math.max(maxY, bottom);

        // Process children recursively
        if (element.child) {
            const children = Array.isArray(element.child) ? element.child : [element.child];
            children.flat(Infinity).forEach(child => processElement(child));
        }
    }

    // Process all root elements
    elements.forEach(element => processElement(element));

    return { minX, minY, maxX, maxY };
}

async function startupPixiJS() {
    parsedXUI = parsedXUI.flat(Infinity);
    parsedXUI = parsedXUI.reverse();

    await sleep(250);

    // Calculate bounds including negative coordinates
    const bounds = calculateBounds(parsedXUI);
    console.log("Bounds:", bounds);

    // Calculate dimensions including negative space
    const width = bounds.maxX - bounds.minX;
    const height = bounds.maxY - bounds.minY;

    // Calculate final dimensions with minimum sizes and offset
    const finalW = Math.max(width, 1280);
    const finalH = Math.max(height, 1024);

    // Initialize PIXI Application with full size including negative space
    PIXI_APP = new PIXI.Application();
    await PIXI_APP.init({
        width: finalW,
        height: finalH,
        resolution: 1,
        antialias: true,
        backgroundColor: 0x808080
    });

    // Create main container and shift it to accommodate negative coordinates
    const mainContainer = new PIXI.Container();
    
    // Calculate the offset needed to show negative coordinates
    const offsetX = Math.abs(Math.min(0, bounds.minX));
    const offsetY = Math.abs(Math.min(0, bounds.minY));
    
    // Apply the offset to the main container
    mainContainer.position.set(offsetX, offsetY);
    
    // Set the main container as the stage
    PIXI_APP.stage = mainContainer;

    $("#app").append(PIXI_APP.canvas);

    // Process elements with their original coordinates
    const renderPromises = parsedXUI.map(element => 
        handleElement(element, mainContainer)
    );

    // Wait for all elements to be rendered
    await Promise.all(renderPromises);

    // Store the offset for future reference
    PIXI_APP.offset = { x: offsetX, y: offsetY };

    // Now we can safely add hover effects
    addHoverEffects();
}

var currentHoveredShape = null;

function addHoverEffects() {

    
    
    // Update the hideHoverEffects function
   

    // Process all elements in ELEMENT_TREE
    for (let level in ELEMENT_TREE) {
        for (let id in ELEMENT_TREE[level]) {
            let shape = findShapeByIdentifier(PIXI_APP.stage, id);
            if (shape) {
                addHoverToShape(shape);
            }
        }
    }
}

function hideHoverEffects(shape) {
    if (!shape) return;
    if (shape._hoverContainer) {
        shape._hoverContainer.visible = false;
    }
}

function addHoverToShape(shape) {

    if (shape._hoverContainer) {
        shape._hoverContainer.destroy();
        shape._hoverContainer = null;
    }
    
    // Remove existing listeners
    shape.removeListener('pointerover');
    shape.removeListener('pointerout');
    shape.removeListener('click');

    if (!shape || !shape.cgui) return;

    shape.interactive = true;
    shape.buttonMode = true;

    // Create hover container that will be added to the stage instead of the shape
    const hoverContainer = new PIXI.Container();
    hoverContainer._isHoverElement = true;
    hoverContainer.visible = false;
    PIXI_APP.stage.addChild(hoverContainer); // Add to stage directly

    // Create hover overlay
    const hoverOverlay = new PIXI.Graphics();
    hoverOverlay._isHoverElement = true;
    hoverContainer.addChild(hoverOverlay);

    // Create hover text with better visibility
    const hoverText = new PIXI.Text('', {
        fontFamily: 'Arial',
        fontSize: 12,
        fill: 0xFFFFFF,
        stroke: 0x000000,
        strokeThickness: 4,
        align: 'left',
        lineJoin: 'round',
        resolution: 2,
        dropShadow: true,
        dropShadowColor: '#000000',
        dropShadowBlur: 4,
        dropShadowAngle: Math.PI / 6,
        dropShadowDistance: 2
    });
    hoverText._isHoverElement = true;
    hoverContainer.addChild(hoverText);

    shape.on("pointerover", function(event) {
        event.stopPropagation();
        
        if (shape.dragging) return;

        if (lastSelectedShape === shape) return;

        // Hide previous hover effects
        if (currentHoveredShape && currentHoveredShape !== shape) {
            hideHoverEffects(currentHoveredShape);
        }

        currentHoveredShape = shape;

        // Convert shape's position to global coordinates
        const globalPos = shape.parent.toGlobal(new PIXI.Point(shape.x, shape.y));
        const width = shape.cgui.position_local.right - shape.cgui.position_local.left;
        const height = shape.cgui.position_local.bottom - shape.cgui.position_local.top;

        // Update hover container position
        hoverContainer.position.set(globalPos.x - PIXI_APP.offset.x, globalPos.y - PIXI_APP.offset.y);

        // Draw hover border with purple color
        hoverOverlay.clear();
        hoverOverlay.lineStyle(2, 0x800080, 1);
        hoverOverlay.beginFill(0x800080, 0.2);
        hoverOverlay.drawRect(0, 0, width, height);
        hoverOverlay.endFill();

        // Update text content
        hoverText.text = `${shape.cgui_type} - ${shape.cgui_name}`;
        
        // Position text in top-left corner with padding
        hoverText.position.set(5, 5);

        // Show hover elements
        hoverContainer.visible = true;
        hoverContainer.zIndex = 999999; // Ensure it's always on top
    });

    shape.on("pointerout", function(event) {
        hoverContainer.visible = false;
        if (currentHoveredShape === shape) {
            currentHoveredShape = null;
        }
    });

    shape.on("click", function(event) {
        event.stopPropagation();

        $('#treeview').jstree('deselect_all', true);
        
        // Disable hover effect for this shape
        if (currentHoveredShape === shape) {
            hideHoverEffects(shape);
            currentHoveredShape = null;
        }

        // Find and select the corresponding node in the treeview
        $('#treeview').jstree('select_node', shape.cgui.identifier);
    });

    // Store hover container reference on shape for cleanup
    shape._hoverContainer = hoverContainer;
}

async function handleCGUI_GroupBox(element) {
    let children = element["child"];
    children = children.flat(Infinity);
    children = children.reverse();

    let parent = findParent(element);

    const container = await createNewContainer(element, parent);

    for (const element of children) {
        await handleElement(element, container);
    }
}

function findParent(element) {
    let parent = null;

    let ident = element["identifier"];

    function searchParent(currentElement, children) {
        for (const child of children) {
            if (child["identifier"] === ident) {
                parent = currentElement;
                return;
            }
            if (child["child"]) {
                searchParent(child, child["child"].flat(Infinity));
            }
        }
    }

    searchParent(null, parsedXUI.flat(Infinity));
    return parent;
}

async function handleElement(element, container) {
    const type = element.key;

    switch (type) {
        case "CGUI_Image":
        case "CGUI_Button":
        case "CGUI_TextBox":
        case "CGUI_RadioButton":
        case "CGUI_ComboBoxEx":
        case "CCustomGUI_TextBox":
        case "CGUI_CheckButton":
        case "CGUI_TabButton":
        case "CGUI_VScrollBar":
        case "CGUI_ListBox":
        case "CGUI_ProgressBar":
        case "CGUI_TextViewer":
        case "CGUI_MenuBox":
            await draw_CGUI_Texture(element, container);
            break;

        case "CGUI_Label":
            await draw_CGUI_Text(element, container);
            break;

        case "CGUI_GroupBox":
            await handleCGUI_GroupBox(element);
            break;

        case "CGUI_Window":
            await handle_CGUI_Window(element);
            break;

        default:
            console.error("Unhandled CGUI_GroupBox child type " + type);
            break;
    }
}

async function handle_CGUI_Window(element) {
    console.debug("Drawing CGUI_Window");

    let parent = findParent(element);

    const container = await createNewContainer(element, parent);

    if (Array.isArray(element["child"])) {
        let children = element["child"];
        children = children.flat(Infinity);
        children = children.reverse();
        for (child of children) {
            await handleElement(child, container);
        }
    } else {
        await handleElement(element["child"], container);
    }
}


async function draw_CGUI_Text(element, container) {
    const color = element["label"]["color"];
    const hexColor = "#" + Number(color).toString(16).padStart(8, "0");
    const _font = element["label"]["font"];

    let i = _font.indexOf("_");
    const fontSize = Number(_font.substring(i + 1));
    const font = _font.substring(0, i);

    let pos = "local";

    const textContainer = new PIXI.Container();
    textContainer.x = Number(element["position_" + pos]["left"]);
    textContainer.y = Number(element["position_" + pos]["top"]);
    let containerWidth =
        Number(element["position_" + pos]["right"]) -
        Number(element["position_" + pos]["left"]);
    let containerHeight =
        Number(element["position_" + pos]["bottom"]) -
        Number(element["position_" + pos]["top"]);
    textContainer.width = containerWidth;
    textContainer.height = containerHeight;
    textContainer.cgui = element;

    textContainer.cgui_type = element.key;
    textContainer.cgui_name = element.name;


    const text = new PIXI.Text({
        text: element["label"]["label"],
        style: {
            fill: hexColor,
            fontSize: fontSize,
            fontFamily: font,
            resolution: 4, // Increases text resolution
            antialias: true, // Enables antialiasing
        }
    });


    text.y = containerHeight / 2 - text.height / 2;

    switch (element["label"]["textAlign"]) {
        case "1": // Left
            text.x = 0;
            text.x += Number(element["label"]["margin_x"]);
            break;
        case "0":
        case "2": // Center
            text.x = containerWidth / 2 - text.width / 2;
            break;
        case "3": // Right
            text.x = containerWidth - text.width;
            text.x -= Number(element["label"]["margin_x"]);
            break;
    }

    text.y += Number(element["label"]["margin_y"]);

    textContainer.addChild(text);

    if (element["enable"] === false || element["show"] === false) {
        textContainer.visible = false;
    }

    if (!ELEMENT_TREE[element["level"]]) {
        ELEMENT_TREE[element["level"]] = {};
    }

    ELEMENT_TREE[element["level"]][element["identifier"]] = {
        element: element,
        parent: container,
    };

    container.addChild(textContainer);
}

async function draw_CGUI_Texture(element, container) {
    const textures = element["textures"];

    // Create a container for the shape
    const shapeContainer = new PIXI.Container();
    shapeContainer.cgui_type = element.key;
    shapeContainer.cgui_name = element.name;
    shapeContainer.cgui = element;
    shapeContainer.textures = [];
    shapeContainer.cgui_parent = container;

    shapeContainer.x = Number(element["position_local"]["left"]);
    shapeContainer.y = Number(element["position_local"]["top"]);

    for (const texture of textures) {
        const img = await loadImage(texture["texture"]);

        if (!img) {
            console.error(
                "Failed to load image " +
                    location.origin +
                    "/textures/" +
                    texture["texture"]
            );
            continue;
        }

        const left = texture["left"] * img.width;
        const top = texture["top"] * img.height;
        const right = texture["right"] * img.width;
        const bottom = texture["bottom"] * img.height;
        const width = right - left;
        const height = bottom - top;

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");

        ctx.drawImage(img, left, top, width, height, 0, 0, width, height);

        const sprite = new PIXI.Sprite(PIXI.Texture.from(canvas));

        let pos = "global";

        sprite.x = 0;
        sprite.y = 0;
        sprite.width =
            Number(element["position_" + pos]["right"]) -
            Number(element["position_" + pos]["left"]);
        sprite.height =
            Number(element["position_" + pos]["bottom"]) -
            Number(element["position_" + pos]["top"]);
        sprite.interactive = true;
        sprite.buttonMode = true;

        switch (texture["flipType"]) {
            case "0": // No flip
                break;
            case "1": // Horizontal flip
                sprite.scale.x = -1;
                sprite.x += sprite.width;
                break;
            case "2": // Vertical flip
                sprite.scale.y = -1;
                sprite.y += sprite.height;
                break;
            case "3": // Both horizontal and vertical flip (180° rotation)
                sprite.scale.x = -1;
                sprite.scale.y = -1;
                sprite.x += sprite.width;
                sprite.y += sprite.height;
                break;
        }

        /*switch (texture["blendType"]) {
            case "0": // Normal
                sprite.blendMode = "normal";
                break;
            case "1": // Add/Additive
                sprite.blendMode = "add";
                break;
            case "2": // Multiply
                sprite.blendMode = "multiply";
                break;
            case "3": // Alpha
                sprite.blendMode = "screen";
                break;
            default:
                sprite.blendMode = "normal";
                break;
        }*/



        

        shapeContainer.addChild(sprite);
        shapeContainer.textures.push(sprite);
    }

    //Label Part
    if (element["label"]["label"] !== "") {
        const color = element["label"]["color"];
        const hexColor = "#" + Number(color).toString(16).padStart(8, "0");
        const _font = element["label"]["font"];

        let i = _font.indexOf("_");
        const fontSize = Number(_font.substring(i + 1));
        const font = _font.substring(0, i);

        let pos = "local";

        const textContainer = new PIXI.Container();
        textContainer.x = 0;
        textContainer.y = 0;
        let containerWidth =
            Number(element["position_" + pos]["right"]) -
            Number(element["position_" + pos]["left"]);
        let containerHeight =
            Number(element["position_" + pos]["bottom"]) -
            Number(element["position_" + pos]["top"]);
        textContainer.width = containerWidth;
        textContainer.height = containerHeight;
        textContainer.cgui = element;

        textContainer.cgui_type = element.key;
        textContainer.cgui_name = element.name;

        const text = new PIXI.Text({
            text: element["label"]["label"],
            style: {
                fill: hexColor,
                fontSize: fontSize,
                fontFamily: font,
                resolution: 4, // Increases text resolution
                antialias: true, // Enables antialiasing
            }
        });


        text.y = containerHeight / 2 - text.height / 2;

        switch (element["label"]["textAlign"]) {
            case "1": // Left
                text.x = 0;
                text.x += Number(element["label"]["margin_x"]);
                break;
            case "0":
            case "2": // Center
                text.x = containerWidth / 2 - text.width / 2;
                break;
            case "3": // Right
                text.x = containerWidth - text.width;
                text.x -= Number(element["label"]["margin_x"]);
                break;
        }

        text.y += Number(element["label"]["margin_y"]);

        textContainer.addChild(text);

        shapeContainer.addChild(textContainer);
    }

    if (element["enable"] === false || element["show"] === false) {
        shapeContainer.visible = false;
    }

    if (container === undefined) {
        PIXI_APP.stage.addChild(shapeContainer);
    } else {
        container.addChild(shapeContainer);
    }
    //console.log("Element " + element.key + " - " + element.name + " drawn for parent" + container.cgui_name, container.visible);

    if (!ELEMENT_TREE[element["level"]]) {
        ELEMENT_TREE[element["level"]] = {};
    }

    ELEMENT_TREE[element["level"]][element["identifier"]] = {
        element: element,
        parent: container,
    };
}

async function loadImage(src) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => resolve(null);
        img.src = location.origin + "/textures/" + src;
    });
}

$(async function () {
    setTimeout(() => {}, 1000);

    await startupPixiJS();
    createTreeView();

    let counter = 0;
    var int = setInterval(() => {
        createTreeView();
        counter++;
    }, 1000);
});

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

var containerList = [];

var intersectLevel = 0;
async function createNewContainer(element, parent = null) {
    var boxContainer = new PIXI.Container();

    if (parent) {
        boxContainer.x = Number(element["position_local"]["left"]);
        boxContainer.y = Number(element["position_local"]["top"]);
    } else {
        boxContainer.x = Number(element["position_local"]["left"]);
        boxContainer.y = Number(element["position_local"]["top"]);
    }

    boxContainer.cgui_type = element["key"];
    boxContainer.cgui_name = element["name"];
    boxContainer.cgui = element;
    boxContainer.cgui_parent = parent;

    if ((element["enable"] === false || element["show"] === false) && element["key"] !== "CGUI_Window") {
        //console.log("Hiding element", element["key"] + " - " + element["name"]);
        boxContainer.visible = false;
    }

    //console.log("Creating container for " + element["key"] + " - " + element["name"], parent);

    if (parent) {
        var parentElement = containerList[parent["identifier"]];

        if (parentElement) {
            //console.log(containerList);
            parentElement.addChild(boxContainer);
        } else {
            //console.log("BOX FALLBACK");
            if (containerList[parent["identifier"]]) {
                if (element.intersect) {
                    PIXI_APP.stage.addChild(boxContainer);
                } else {
                    PIXI_APP.stage.addChildAt(boxContainer, intersectLevel);
                }
            } else {
                if (element.intersect) {
                    PIXI_APP.stage.addChild(boxContainer);
                } else {
                    PIXI_APP.stage.addChildAt(boxContainer, intersectLevel);
                }
            }
        }
    } else {
        if (element.intersect) {
            PIXI_APP.stage.addChild(boxContainer);
        } else {
            PIXI_APP.stage.addChildAt(boxContainer, intersectLevel);
        }
    }

    if (!containerList.includes(`${element["identifier"]}`)) {
        containerList[`${element["identifier"]}`] = boxContainer;
    }

    if (!ELEMENT_TREE[element["level"]]) {
        ELEMENT_TREE[element["level"]] = {};
    }

    if (parent) {
        ELEMENT_TREE[element["level"]][element["identifier"]] = {
            element: element,
            parent: containerList[parent["identifier"]] || null,
        };
    } else {
        ELEMENT_TREE[element["level"]][element["identifier"]] = {
            element: element,
            parent: null,
        };
    }

    return boxContainer;
}

let oldHtml = "";

function loadTreeViewChildren(element, level) {
    let parentId = element.element.identifier;

    let local_ELEMENT_TREE = Object.values(ELEMENT_TREE);

    if (local_ELEMENT_TREE.length == 0) {
        return [];
    }

    if (!local_ELEMENT_TREE[level]) {
        return [];
    }

    let levelItems = Object.values(local_ELEMENT_TREE[level]);

    if (levelItems.length == 0) {
        return [];
    }

    let nodes = [];

    levelItems.forEach((item) => {
        if (
            item.parent &&
            item.parent.cgui &&
            item.parent.cgui.identifier != parentId
        ) {
            return;
        }

        let icon = "";

        switch (item.element.key) {
            case "CGUI_GroupBox":
                icon = "fa-solid fa-layer-group";
                break;
            case "CGUI_Image":
                icon = "fa-solid fa-image";
                break;
            case "CGUI_Button":
                icon = "fa-solid fa-mouse-pointer";
                break;
            case "CGUI_TextBox":
                icon = "fa-solid fa-keyboard";
                break;
            case "CGUI_RadioButton":
                icon = "fa-solid fa-dot-circle";
                break;
            case "CGUI_ComboBoxEx":
                icon = "fa-solid fa-caret-down";
                break;
            case "CCustomGUI_TextBox":
                icon = "fa-solid fa-keyboard";
                break;
            case "CGUI_CheckButton":
                icon = "fa-solid fa-check-square";
                break;
            case "CGUI_TabButton":
                icon = "fa-solid fa-tab";
                break;
            case "CGUI_VScrollBar":
                icon = "fa-solid fa-scroll";
                break;
            case "CGUI_ListBox":
                icon = "fa-solid fa-list";
                break;
            case "CGUI_ProgressBar":
                icon = "fa-solid fa-tasks";
                break;
            case "CGUI_TextViewer":
                icon = "fa-solid fa-file-alt";
                break;
            case "CGUI_MenuBox":
                icon = "fa-solid fa-list";
                break;
            case "CGUI_Label":
                icon = "fa-solid fa-font";
                break;
            case "CGUI_Window":
                icon = "fa-solid fa-window";
                break;
            default:
                icon = "fa-solid fa-question";
                break;
        }

        let node = {
            text: `${item.element.key} - ${item.element.name}`,
            state: {
                opened: false,
                selected: false,
            },
            icon: icon,
            id: item.element.identifier,
            li_attr: {
                class: [
                    item.element.enable && item.element.show ? "tree-xui-enabled" : "tree-xui-disabled",
                    (item.element.local_show === false || item.element.local_enable === false) ? "tree-xui-local-hidden" : ""
                ].filter(Boolean).join(" ")
            },
        };

        if (item.element.key == "CGUI_GroupBox") {
            node.children = loadTreeViewChildren(item, item.element.level + 1);
        }

        nodes.push(node);
    });

    return nodes;
}

function createTreeView() {
    let treeData = [];
    let selectedNode = $('#treeview').jstree('get_selected')[0]; // Store currently selected node


    let local_ELEMENT_TREE = Object.values(ELEMENT_TREE);

    if (local_ELEMENT_TREE.length == 0) {
        return;
    }

    let firstLevel = Object.values(local_ELEMENT_TREE[0]);
    firstLevel.forEach((element) => {
        let node = {
            id: element.element.identifier,
            text: `${element.element.key} - ${element.element.name}`,
            state: {
                opened: false,
                selected: false,
            },
            icon: "fa-solid fa-window-maximize",
            li_attr: {
                class: [
                    element.element.enable && element.element.show ? "tree-xui-enabled" : "tree-xui-disabled",
                    (element.element.local_show === false || element.element.local_enable === false) ? "tree-xui-local-hidden" : ""
                ].filter(Boolean).join(" ")
            },
            children: loadTreeViewChildren(element, 1),
        };

        treeData.push(node);
    });

    if (oldHtml != JSON.stringify(treeData)) {
        //console.log(ELEMENT_TREE);
        $("#treeview").jstree("destroy");
        $("#treeview")
            .jstree({
                plugins: ["wholerow"],
                core: {
                    data: treeData,
                },
            })
            .on('loaded.jstree', function() {
                // Restore selection after tree is loaded
                if (selectedNode) {
                    $('#treeview').jstree('select_node', selectedNode);
                }
            })
            .on("select_node.jstree", function (e, data) {

                var node = data.node;
                //console.log("Node selected: ", node);
                let element = findElementByIdentifier(node.id);

                highlightElementOnCanvas(element);
                openSidebarDrawer(element);
            });
        oldHtml = JSON.stringify(treeData);
    }
}

let lastOpenedSideBarId ="";
function openSidebarDrawer(element) {
    let stage = PIXI_APP.stage;

    if (element.key === "CGUI_Window") {
        console.log("Cannot highlight window currently");
        return;
    }

    let shape = findShapeByIdentifier(stage, element.identifier);
    if (!shape) {
        console.log("Not found on canvas:", element.identifier);
        return;
    }

    

   //if(lastOpenedSideBarId != element.identifier){
   //    lastOpenedSideBarId = element.identifier;
   //}else{
   //    return;
   //}

    let sidebar = document.getElementById("offcanvasScrolling");
    let offcanvas = bootstrap.Offcanvas.getInstance(sidebar) || new bootstrap.Offcanvas(sidebar);

    sidebar.removeEventListener('hidden.bs.offcanvas', handleOffcanvasHidden);
    sidebar.addEventListener('hidden.bs.offcanvas', handleOffcanvasHidden);

    //offcanvas.hide();

    console.log(shape);
    console.log(element);

    $("#identifier").val(element.identifier);
    $("#element-name").val(element.key + " - " + element.name);
    $("#element-visible").prop("checked", element.show);
    $("#element-visible-local").prop("checked", element.local_show !== undefined ? element.local_show : element.show);
    $("#element-enabled").prop("checked", element.enable);
    $("#element-enabled-local").prop("checked", element.local_enable !== undefined ? element.local_enable : element.enable);

    $("#element-global-left").val(element.position_global.left);
    $("#element-global-top").val(element.position_global.top);
    $("#element-global-right").val(element.position_global.right);
    $("#element-global-bottom").val(element.position_global.bottom);

    $("#element-local-left").val(element.position_local.left);
    $("#element-local-top").val(element.position_local.top);
    $("#element-local-right").val(element.position_local.right);
    $("#element-local-bottom").val(element.position_local.bottom);

    $("#element-textures").html("");
    

    if (element.textures && element.textures.length > 0) {
        $("#element-textures").append("<h5>Textures</h5>");
        element.textures.forEach((texture) => {
            let container = document.createElement("div");
            container.style.position = "relative";
            container.style.display = "inline-block";
            container.style.margin = "5px";
            container.title = texture.texture;
            container.classList.add("img-tooltip");
    
            // Create the main image
            let img = document.createElement("img");
            img.src = "textures/" + texture.texture;
            img.style.width = "300px";
            //img.style.maxHeight = "300px";
            img.style.objectFit = "contain";
            img.alt = texture.texture;
            img.title = texture.texture;
            img.classList.add("img-tooltip");
    
            // Add image load event to calculate correct overlay position
            img.onload = function() {
                let containerWidth = 300;
                let containerHeight = img.height;
                let imageAspectRatio = img.naturalWidth / img.naturalHeight;
                let containerAspectRatio = containerWidth / containerHeight;
    
                let imageDisplayWidth, imageDisplayHeight;
                let offsetX = 0, offsetY = 0;
    
                if (imageAspectRatio > containerAspectRatio) {
                    // Image is wider than container ratio
                    imageDisplayWidth = containerWidth;
                    imageDisplayHeight = containerWidth / imageAspectRatio;
                    offsetY = (containerHeight - imageDisplayHeight) / 2;
                } else {
                    // Image is taller than container ratio
                    imageDisplayHeight = containerHeight;
                    imageDisplayWidth = containerHeight * imageAspectRatio;
                    offsetX = (containerWidth - imageDisplayWidth) / 2;
                }
    
                // Update overlay position and size
                overlay.style.left = `${offsetX + (texture.left * imageDisplayWidth)}px`;
                overlay.style.top = `${offsetY + (texture.top * imageDisplayHeight)}px`;
                overlay.style.width = `${(texture.right - texture.left) * imageDisplayWidth}px`;
                overlay.style.height = `${(texture.bottom - texture.top) * imageDisplayHeight}px`;
            };
    
            // Create the overlay div
            let overlay = document.createElement("div");
            overlay.style.position = "absolute";
            overlay.style.border = "2px solid red";
            overlay.style.pointerEvents = "none";
    
            // Add both elements to the container
            container.appendChild(img);
            container.appendChild(overlay);
            $("#element-textures").append(container);
        });
    }

    // Enable global position inputs
    $("#element-global-left").prop("disabled", false);
    $("#element-global-top").prop("disabled", false);
    $("#element-global-right").prop("disabled", false);
    $("#element-global-bottom").prop("disabled", false);

    // Disable local position inputs
    $("#element-local-left").prop("disabled", true);
    $("#element-local-top").prop("disabled", true);
    $("#element-local-right").prop("disabled", true);
    $("#element-local-bottom").prop("disabled", true);

    offcanvas.show();

    $(".img-tooltip").tooltip({
        container: 'body',
        placement: 'top',
        boundary: 'window',
        zIndex: 9999999 // Very high z-index
    });
}

function handleOffcanvasHidden() {
    // Remove transformers
    removeAllTransformers(PIXI_APP.stage);

    // Clear last selected shape and re-enable hover
    if (lastSelectedShape) {
        // Remove existing hover effects
        if (lastSelectedShape._hoverContainer) {
            lastSelectedShape._hoverContainer.destroy();
            lastSelectedShape._hoverContainer = null;
        }
        lastSelectedShape.removeAllListeners();
        lastSelectedShape.interactive = true;
        lastSelectedShape.buttonMode = true;
        addHoverToShape(lastSelectedShape); // Add fresh hover effects
        lastSelectedShape = null;
        $('#treeview').jstree('deselect_all', true);
    }

    // Re-render the stage
    PIXI_APP.render();
}

// Add debounce utility function
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Handle global position changes
$(document).on("input", ".global-position", debounce(function(e) {
    updatePositionFromGlobal(true);
}, 16));

$(document).on("blur", ".global-position", function() {
    updatePositionFromGlobal(true);
});

// Handle local position changes
$(document).on("input", ".local-position", debounce(function() {
    updatePositionFromLocal(true);
}, 16)); // 60fps

$(document).on("blur", ".local-position", function() {
    updatePositionFromLocal(true);
});

function updatePositionFromGlobal(isFinal) {
    let identifier = $("#identifier").val();
    let left = $("#element-global-left").val();
    let top = $("#element-global-top").val();
    let right = $("#element-global-right").val();
    let bottom = $("#element-global-bottom").val();
    
    if (left === "" || top === "" || right === "" || bottom === "") return;
    
    // Parse all values as floats and round them
    left = Math.round(parseFloat(left));
    top = Math.round(parseFloat(top));
    right = Math.round(parseFloat(right));
    bottom = Math.round(parseFloat(bottom));

    let element = findElementByIdentifier(identifier);
    let shape = findShapeByIdentifier(PIXI_APP.stage, identifier);
    
    if (!element || !shape) return;

    // Get the changed input field
    const changedField = document.activeElement.id;
    
    // Store original dimensions
    const originalWidth = shape.cgui.position_global.right - shape.cgui.position_global.left;
    const originalHeight = shape.cgui.position_global.bottom - shape.cgui.position_global.top;

    // If left or top changed, maintain dimensions by adjusting right/bottom
    if (changedField === "element-global-left") {
        right = left + originalWidth;
        $("#element-global-right").val(Math.round(right));
    } else if (changedField === "element-global-top") {
        bottom = top + originalHeight;
        $("#element-global-bottom").val(Math.round(bottom));
    }

    // Convert global to local position
    if (shape.parent) {
        // Convert global coordinates to stage coordinates by adding offset
        let newGlobalPosTopLeft = new PIXI.Point(
            left + PIXI_APP.offset.x, 
            top + PIXI_APP.offset.y
        );
        let newGlobalPosBottomRight = new PIXI.Point(
            right + PIXI_APP.offset.x,
            bottom + PIXI_APP.offset.y
        );

        // Convert stage coordinates to local coordinates
        let localPosTopLeft = shape.parent.toLocal(newGlobalPosTopLeft, PIXI_APP.stage);
        let localPosBottomRight = shape.parent.toLocal(newGlobalPosBottomRight, PIXI_APP.stage);

        // Round the local positions
        localPosTopLeft.x = Math.round(localPosTopLeft.x);
        localPosTopLeft.y = Math.round(localPosTopLeft.y);
        localPosBottomRight.x = Math.round(localPosBottomRight.x);
        localPosBottomRight.y = Math.round(localPosBottomRight.y);

        // Calculate dimensions
        const width = Math.abs(localPosBottomRight.x - localPosTopLeft.x);
        const height = Math.abs(localPosBottomRight.y - localPosTopLeft.y);

        // Determine if we need to flip based on the actual positions
        const shouldFlipX = localPosBottomRight.x < localPosTopLeft.x;
        const shouldFlipY = localPosBottomRight.y < localPosTopLeft.y;

        // Update shape position using the leftmost/topmost point
        const finalLeft = Math.min(localPosTopLeft.x, localPosBottomRight.x);
        const finalTop = Math.min(localPosTopLeft.y, localPosBottomRight.y);
        
        // Set the shape position with the offset subtracted for visual display
        shape.position.set(
            finalLeft - PIXI_APP.offset.x,
            finalTop - PIXI_APP.offset.y
        );

        // For sprites/textures, update their dimensions and flipping
        if (shape.textures) {
            shape.textures.forEach(sprite => {
                // Reset sprite position and scale
                sprite.x = 0;
                sprite.y = 0;
                sprite.width = width;
                sprite.height = height;
                sprite.scale.x = Math.abs(sprite.scale.x);
                sprite.scale.y = Math.abs(sprite.scale.y);

                // Apply flipping only if needed
                if (shouldFlipX) {
                    sprite.scale.x *= -1;
                    sprite.x = width;
                }
                if (shouldFlipY) {
                    sprite.scale.y *= -1;
                    sprite.y = height;
                }
            });
        }

        // Update local position input fields with ordered coordinates
        $("#element-local-left").val(finalLeft);
        $("#element-local-top").val(finalTop);
        $("#element-local-right").val(finalLeft + width);
        $("#element-local-bottom").val(finalTop + height);

        // Update element positions
        if (isFinal) {
            updateElementPosition(identifier, finalLeft, finalTop, 
                               finalLeft + width, finalTop + height);
        }

        // Update the transformer box position
        if (lastSelectedShape === shape) {
            removeAllTransformers(PIXI_APP.stage);
            highlightElementOnCanvas(element);
        }
    }

    PIXI_APP.render();
}

function updatePositionFromLocal(isFinal) {
    let identifier = $("#identifier").val();
    let left = $("#element-local-left").val();
    let top = $("#element-local-top").val();
    let right = $("#element-local-right").val();
    let bottom = $("#element-local-bottom").val();
    
    if (left === "" || top === "" || right === "" || bottom === "") return;
    
    left = Math.round(parseFloat(left));
    top = Math.round(parseFloat(top));
    right = Math.round(parseFloat(right));
    bottom = Math.round(parseFloat(bottom));
    
    let element = findElementByIdentifier(identifier);
    let shape = findShapeByIdentifier(PIXI_APP.stage, identifier);
    
    if (!element || !shape) return;

    // Update shape position and dimensions using local coordinates with offset subtracted
    shape.position.set(
        left - PIXI_APP.offset.x,
        top - PIXI_APP.offset.y
    );
    
    // For sprites/textures, update their dimensions
    if (shape.textures) {
        shape.textures.forEach(sprite => {
            sprite.width = right - left;
            sprite.height = bottom - top;
        });
    }

    // Update element positions
    if (isFinal) {
        updateElementPosition(identifier, left, top, right, bottom);
    }

    // Convert to global for display only
    if (shape.parent) {
        let globalPosTopLeft = shape.parent.toGlobal(new PIXI.Point(left, top));
        let globalPosBottomRight = shape.parent.toGlobal(new PIXI.Point(right, bottom));
        
        // Update global input fields
        $("#element-global-left").val(Math.round(globalPosTopLeft.x - PIXI_APP.offset.x));
        $("#element-global-top").val(Math.round(globalPosTopLeft.y - PIXI_APP.offset.y));
        $("#element-global-right").val(Math.round(globalPosBottomRight.x - PIXI_APP.offset.x));
        $("#element-global-bottom").val(Math.round(globalPosBottomRight.y - PIXI_APP.offset.y));
    }

    PIXI_APP.render();
}

function updateElementPosition(identifier, left, top, right, bottom) {
    let element = findElementByIdentifier(identifier);

    if (element) {
        let stage = PIXI_APP.stage;
        let shape = findShapeByIdentifier(stage, element.identifier);
        if (shape) {
            // Set shape position using local coordinates with offset subtracted
            shape.position.set(
                left - PIXI_APP.offset.x,
                top - PIXI_APP.offset.y
            );

            // Calculate dimensions
            let width = right - left;
            let height = bottom - top;

            // Create local position object
            let localPosition = {
                left: Math.round(left),
                top: Math.round(top),
                right: Math.round(right),
                bottom: Math.round(bottom)
            };

            // Convert local position to global position
            let globalTopLeft = shape.parent.toGlobal(new PIXI.Point(left, top));
            let globalBotRight = shape.parent.toGlobal(new PIXI.Point(right, bottom));

            // Create global position object
            let globalPosition = {
                left: Math.round(globalTopLeft.x - PIXI_APP.offset.x),
                top: Math.round(globalTopLeft.y - PIXI_APP.offset.y),
                right: Math.round(globalBotRight.x - PIXI_APP.offset.x),
                bottom: Math.round(globalBotRight.y - PIXI_APP.offset.y)
            };

            // Calculate the change in global position
            const deltaX = globalPosition.left - shape.cgui.position_global.left;
            const deltaY = globalPosition.top - shape.cgui.position_global.top;

            // Update positions in cgui
            shape.cgui.position_local = localPosition;
            shape.cgui.position_global = globalPosition;

            // Update positions in element tree
            for (let level in ELEMENT_TREE) {
                for (let id in ELEMENT_TREE[level]) {
                    if (id === identifier) {
                        ELEMENT_TREE[level][id].element.position_local = localPosition;
                        ELEMENT_TREE[level][id].element.position_global = globalPosition;

                        // If this is a GroupBox, update all children's global positions recursively
                        if (element.key === "CGUI_GroupBox" && element.child) {
                            function updateChildrenPositions(children, dx, dy) {
                                const childArray = Array.isArray(children) ? children : [children];
                                childArray.flat(Infinity).forEach(child => {
                                    const childShape = findShapeByIdentifier(stage, child.identifier);
                                    if (childShape) {
                                        // Ensure numeric calculations by parsing values
                                        const childWidth = parseFloat(childShape.cgui.position_global.right) - parseFloat(childShape.cgui.position_global.left);
                                        const childHeight = parseFloat(childShape.cgui.position_global.bottom) - parseFloat(childShape.cgui.position_global.top);
                                        const newLeft = parseFloat(childShape.cgui.position_global.left) + parseFloat(dx);
                                        const newTop = parseFloat(childShape.cgui.position_global.top) + parseFloat(dy);

                                        const newChildGlobalPosition = {
                                            left: Math.round(newLeft),
                                            top: Math.round(newTop),
                                            right: Math.round(newLeft + childWidth),
                                            bottom: Math.round(newTop + childHeight)
                                        };

                                        // Update child's global position in both shape and element tree
                                        childShape.cgui.position_global = newChildGlobalPosition;
                                        for (let childLevel in ELEMENT_TREE) {
                                            for (let childId in ELEMENT_TREE[childLevel]) {
                                                if (childId === child.identifier) {
                                                    ELEMENT_TREE[childLevel][childId].element.position_global = newChildGlobalPosition;
                                                }
                                            }
                                        }

                                        // Recursively update this child's children if it's a GroupBox
                                        if (child.key === "CGUI_GroupBox" && child.child) {
                                            updateChildrenPositions(child.child, dx, dy);
                                        }
                                    }
                                });
                            }

                            // Start the recursive update with the initial children
                            updateChildrenPositions(element.child, deltaX, deltaY);
                        }
                    }
                }
            }
        }
    }

    PIXI_APP.render();

    // Adjust the transformer
    removeAllTransformers(PIXI_APP.stage);
    highlightElementOnCanvas(element);
}

$(document).on("change", "#element-visible", function () {
    let identifier = $("#identifier").val();
    let visible = $(this).prop("checked");

    updateElementVisibility(identifier, visible);
});

$(document).on("change", "#element-visible-local", function () {
    let identifier = $("#identifier").val();
    let visible = $(this).prop("checked");

    updateElementVisibility(identifier, visible, true);
});

$(document).on("change", "#element-enabled", function () {
    let identifier = $("#identifier").val();
    let enabled = $(this).prop("checked");

    updateElementEnabled(identifier, enabled);
});

$(document).on("change", "#element-enabled-local", function () {
    let identifier = $("#identifier").val();
    let enabled = $(this).prop("checked");

    updateElementEnabled(identifier, enabled, true);
});

function updateElementVisibility(identifier, visible, local = false) {
    let element = findElementByIdentifier(identifier);

    console.log(visible);
    console.log(local);

    if (element) {
        let stage = PIXI_APP.stage;
        let shape = findShapeByIdentifier(stage, element.identifier);
        if (shape) {
            if (local) {
                // Update local visibility
                shape.cgui.local_show = visible;
                shape.visible = visible;
                
                // Update element tree
                for (let level in ELEMENT_TREE) {
                    for (let id in ELEMENT_TREE[level]) {
                        if (id === identifier) {
                            ELEMENT_TREE[level][id].element.local_show = visible;
                        }
                    }
                }
            } else {
                // Update global visibility
                shape.cgui.show = visible;
                shape.cgui.local_show = visible; // Reset local to match global
                shape.visible = visible;
                
                // Update element tree
                for (let level in ELEMENT_TREE) {
                    for (let id in ELEMENT_TREE[level]) {
                        if (id === identifier) {
                            ELEMENT_TREE[level][id].element.show = visible;
                            ELEMENT_TREE[level][id].element.local_show = visible;
                        }
                    }
                }
            }
        }
    }

    // Update tree view to reflect changes
    createTreeView();
    PIXI_APP.render();
}

function updateElementEnabled(identifier, enabled, local = false) {
    let element = findElementByIdentifier(identifier);

    if (element) {
        let stage = PIXI_APP.stage;
        let shape = findShapeByIdentifier(stage, element.identifier);
        if (shape) {
            if (local) {
                // Update local enabled state
                shape.cgui.local_enable = enabled;
                shape.interactive = enabled;
                shape.buttonMode = enabled;
                
                // Update element tree
                for (let level in ELEMENT_TREE) {
                    for (let id in ELEMENT_TREE[level]) {
                        if (id === identifier) {
                            ELEMENT_TREE[level][id].element.local_enable = enabled;
                        }
                    }
                }
            } else {
                // Update global enabled state
                shape.cgui.enable = enabled;
                shape.cgui.local_enable = enabled; // Reset local to match global
                shape.interactive = enabled;
                shape.buttonMode = enabled;
                
                // Update element tree
                for (let level in ELEMENT_TREE) {
                    for (let id in ELEMENT_TREE[level]) {
                        if (id === identifier) {
                            ELEMENT_TREE[level][id].element.enable = enabled;
                            ELEMENT_TREE[level][id].element.local_enable = enabled;
                        }
                    }
                }
            }
        }
    }

    // Update tree view to reflect changes
    createTreeView();
    PIXI_APP.render();
}

// Add this CSS rule to your stylesheet or add it inline
const style = document.createElement('style');
style.textContent = `
    .tree-xui-local-hidden > a {
        font-style: italic !important;
    }
`;
document.head.appendChild(style);

function findElementByIdentifier(identifier) {
    let local_ELEMENT_TREE = Object.values(ELEMENT_TREE);

    if (local_ELEMENT_TREE.length == 0) {
        return null;
    }

    let firstLevel = Object.values(local_ELEMENT_TREE[0]);

    function flatten(arr) {
        return arr.reduce((flat, toFlatten) => {
            return flat.concat(
                Array.isArray(toFlatten) ? flatten(toFlatten) : toFlatten
            );
        }, []);
    }

    function recursiveSearch(items, isChild = false) {
        for (let item of items) {
            if (isChild) {
                if (item.identifier == identifier) {
                    return item;
                }
                if (item.child) {
                    let children = flatten(item.child);
                    let found = recursiveSearch(children, true);
                    if (found) {
                        return found;
                    }
                }
            } else {
                if (item.element.identifier == identifier) {
                    return item;
                }
                if (item.element.child) {
                    let children = flatten(item.element.child);
                    let found = recursiveSearch(children, true);
                    if (found) {
                        return found;
                    }
                }
            }
        }
        return null;
    }

    let element = recursiveSearch(firstLevel);

    if (element) {
        //console.log("Found element: ", element);
    } else {
        //console.log("Element not found");
    }

    return element;
}

function findShapeByIdentifier(container, id) {
    //console.log(container);
    for (let child of container.children) {
        if (child.cgui && child.cgui.identifier === id) return child;
        if (child.children && child.children.length) {
            let found = findShapeByIdentifier(child, id);
            if (found) return found;
        }
    }
    return null;
}

// Remove all old transformers recursively
function removeAllTransformers(container) {
    for (let child of container.children) {
        if (child.label === "transformer") {
            child.destroy();
        }
        if (child.children && child.children.length > 0) {
            removeAllTransformers(child);
        }
    }
}

var lastSelectedShape = null;
function highlightElementOnCanvas(element) {
    console.log("Highlighting:", element);
    let stage = PIXI_APP.stage;

    if (element.key === "CGUI_Window") {
        console.log("Cannot highlight window currently");
        return;
    }

    // Clear the old selection
    resetDragging(stage);
    if (lastSelectedShape) {
        // Remove all existing listeners and hover effects
        lastSelectedShape.removeAllListeners();
        if (lastSelectedShape._hoverContainer) {
            lastSelectedShape._hoverContainer.destroy();
            lastSelectedShape._hoverContainer = null;
        }
        lastSelectedShape.interactive = false;
        lastSelectedShape.buttonMode = false;
        addHoverToShape(lastSelectedShape);
        lastSelectedShape = null;
    }

    
    removeAllTransformers(stage);

    // Find shape
    let shape = findShapeByIdentifier(stage, element.identifier);
    if (!shape) {
        //console.log("Not found on canvas:", element.identifier);
        return;
    }


    if (currentHoveredShape === shape) {
        hideHoverEffects(shape);
        currentHoveredShape = null;
    }

    
    lastSelectedShape = shape;


    //console.log("Found shape:", shape);

    // Create transformer in same parent
    let transformer = new PIXI.Graphics();
    transformer.label = "transformer";
    transformer.zIndex = 99999;
    stage.addChild(transformer);

    // Draw bounding box in shape's coordinate space
    function drawBox() {
        transformer.clear();
        transformer.lineStyle(2, 0xff0000, 1);
        transformer.beginFill(0xff0000, 0.2);

        // Get the shape's global position
        const globalPos = shape.parent.toGlobal(new PIXI.Point(shape.x, shape.y));
        
        // Calculate dimensions in local space
        const width = Math.abs(shape.cgui.position_local.right - shape.cgui.position_local.left);
        const height = Math.abs(shape.cgui.position_local.bottom - shape.cgui.position_local.top);

        // Draw the box
        transformer.drawRect(0, 0, width, height);
        transformer.endFill();
        
        // Position transformer using global coordinates with offset
        transformer.position.set(
            globalPos.x - PIXI_APP.offset.x,
            globalPos.y - PIXI_APP.offset.y
        );
    }
    drawBox();
    // Make shape draggable
    shape.interactive = true;
    shape.buttonMode = true;
    let dragData,
        dragOffset = { x: 0, y: 0 };

    console.log(shape);

    transformer.interactive = true;
    transformer.buttonMode = true;
    transformer
    .on("pointerdown", (e) => {
        resetDragging(stage);
        dragData = e.data;

        // Get local position for initial offset
        let localPos = dragData.getLocalPosition(shape.parent);
        dragOffset.x = localPos.x - shape.x;
        dragOffset.y = localPos.y - shape.y;

        shape.dragging = true;
    })
    .on("pointermove", () => {
        if (!shape.dragging) return;
    
        // Get new position in parent's coordinate space
        let newPos = dragData.getLocalPosition(shape.parent);
        let newLocalX = Math.round(newPos.x - dragOffset.x);
        let newLocalY = Math.round(newPos.y - dragOffset.y);
        
        // Update shape position
        shape.position.set(newLocalX, newLocalY);
    
        // Calculate dimensions
        const localWidth = shape.cgui.position_local.right - shape.cgui.position_local.left;
        const localHeight = shape.cgui.position_local.bottom - shape.cgui.position_local.top;
    
        // Convert to global coordinates
        const globalPos = shape.parent.toGlobal(new PIXI.Point(newLocalX, newLocalY));
        
        // For display values, subtract the offset
        const globalX = Math.round(globalPos.x - PIXI_APP.offset.x);
        const globalY = Math.round(globalPos.y - PIXI_APP.offset.y);
    
        // Update position displays
        $("#element-local-left").val(newLocalX);
        $("#element-local-top").val(newLocalY);
        $("#element-local-right").val(newLocalX + localWidth);
        $("#element-local-bottom").val(newLocalY + localHeight);
    
        $("#element-global-left").val(globalX);
        $("#element-global-top").val(globalY);
        $("#element-global-right").val(globalX + localWidth);
        $("#element-global-bottom").val(globalY + localHeight);
    
        // Update element tree with the correct global coordinates
        updateElementTreePosition(
            element.identifier,
            globalX,
            globalY,
            newLocalX,
            newLocalY,
            shape
        );
        
        drawBox();
    })
        .on("pointerup", endDrag)
        .on("pointerupoutside", endDrag);

    function endDrag() {
        shape.dragging = false;
        dragData = null;
        shape.interactive = true;
            shape.buttonMode = true;
            console.log("reapplied effect", shape);
        addHoverToShape(shape);
    }

    // Simple recursive reset
    function resetDragging(container) {
        for (let c of container.children) {
            c.dragging = false;
            if (c.children && c.children.length > 0) resetDragging(c);
        }
    }

    

    function updateElementTreePosition(identifier, globalX, globalY, localX, localY, shape) {
        for (let level in ELEMENT_TREE) {
            for (let id in ELEMENT_TREE[level]) {
                if (id === identifier) {
                    // Store the original dimensions
                    const originalWidth = shape.cgui.position_local.right - shape.cgui.position_local.left;
                    const originalHeight = shape.cgui.position_local.bottom - shape.cgui.position_local.top;
    
                    // Update local position
                    const localPosition = {
                        left: localX,
                        top: localY,
                        right: localX + originalWidth,
                        bottom: localY + originalHeight
                    };
    
                    // Convert local position to global, considering the offset
                    const stagePos = shape.parent.toGlobal(new PIXI.Point(localX, localY));
                    const globalPosition = {
                        left: Math.round(globalX),
                        top: Math.round(globalY),
                        right: Math.round(globalX + originalWidth),
                        bottom: Math.round(globalY + originalHeight)
                    };
    
                    // Calculate the change in global position
                    const deltaX = globalPosition.left - shape.cgui.position_global.left;
                    const deltaY = globalPosition.top - shape.cgui.position_global.top;
    
                    // Update the element tree
                    ELEMENT_TREE[level][id].element.position_local = localPosition;
                    ELEMENT_TREE[level][id].element.position_global = globalPosition;
    
                    // Update the shape's cgui properties
                    shape.cgui.position_local = localPosition;
                    shape.cgui.position_global = globalPosition;

                    // If this is a GroupBox, update all children's global positions recursively
                    if (shape.cgui_type === "CGUI_GroupBox" && shape.cgui.child) {
                        function updateChildrenPositions(children, dx, dy) {
                            const childArray = Array.isArray(children) ? children : [children];
                            childArray.flat(Infinity).forEach(child => {
                                const childShape = findShapeByIdentifier(PIXI_APP.stage, child.identifier);
                                if (childShape) {
                                    // Ensure numeric calculations by parsing values
                                    const childWidth = parseFloat(childShape.cgui.position_global.right) - parseFloat(childShape.cgui.position_global.left);
                                    const childHeight = parseFloat(childShape.cgui.position_global.bottom) - parseFloat(childShape.cgui.position_global.top);
                                    const newLeft = parseFloat(childShape.cgui.position_global.left) + parseFloat(dx);
                                    const newTop = parseFloat(childShape.cgui.position_global.top) + parseFloat(dy);

                                    const newChildGlobalPosition = {
                                        left: Math.round(newLeft),
                                        top: Math.round(newTop),
                                        right: Math.round(newLeft + childWidth),
                                        bottom: Math.round(newTop + childHeight)
                                    };

                                    // Update child's global position in both shape and element tree
                                    childShape.cgui.position_global = newChildGlobalPosition;
                                    for (let childLevel in ELEMENT_TREE) {
                                        for (let childId in ELEMENT_TREE[childLevel]) {
                                            if (childId === child.identifier) {
                                                ELEMENT_TREE[childLevel][childId].element.position_global = newChildGlobalPosition;
                                            }
                                        }
                                    }
                                }

                                // Recursively update this child's children if it's a GroupBox
                                if (child.key === "CGUI_GroupBox" && child.child) {
                                    updateChildrenPositions(child.child, dx, dy);
                                }
                            });
                        }

                        // Start the recursive update with the initial children
                        updateChildrenPositions(shape.cgui.child, deltaX, deltaY);
                    }
    
                    // Store original positions if not already stored
                    if (!ELEMENT_TREE[level][id].element.position_local_origin) {
                        ELEMENT_TREE[level][id].element.position_local_origin = {...localPosition};
                    }
                    if (!ELEMENT_TREE[level][id].element.position_global_origin) {
                        ELEMENT_TREE[level][id].element.position_global_origin = {...globalPosition};
                    }
                }
            }
        }
    }

    lastSelectedShape = shape;
}

function saveChanges() {
    let local_ELEMENT_TREE = Object.values(ELEMENT_TREE);

    if (local_ELEMENT_TREE.length == 0) {
        return;
    }

    let firstLevel = Object.values(local_ELEMENT_TREE[0]);

    console.log(firstLevel);

    $.ajax({
        type: "POST",
        url: "saveXUI.php",
        data: $.param({
            elements: JSON.stringify(firstLevel), // serialize as JSON string
            xui: xuiFile,
            action: "save-json",
        }), // Serialize data into application/x-www-form-urlencoded format
        success: function (data) {
            // Create a download link for the new XUI file
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = 'xui/new_' + xuiFile;
            a.download = 'new_' + xuiFile.split('/').pop();
            
            // Trigger the download
            document.body.appendChild(a);
            a.click();
            
            // Cleanup
            document.body.removeChild(a);
            
            // Show success message
            alert('XUI file saved and downloaded successfully!');
        },
        error: function(xhr, status, error) {
            alert('Error saving XUI file: ' + error);
        }
    });
}

$(window).ready(function () {
    $("#test").click(function () {
        console.log(saveChanges());
    });

    // Add file upload button and handler
    const uploadButton = $(`
        <div class="upload-container" style="margin: 10px;">
            <input type="file" id="xuiFileUpload" accept=".xui" style="display: none;">
            <button id="uploadBtn" class="btn btn-primary">Upload XUI File</button>
            <div id="uploadStatus" style="margin-top: 10px;"></div>
        </div>
        
    `);

    // Add the upload button to the page
    $("body").prepend(uploadButton);

    // Handle file selection
    $("#uploadBtn").click(function() {
        $("#xuiFileUpload").click();
    });

    $("#xuiFileUpload").change(function(e) {
        const file = e.target.files[0];
        if (!file) return;

        // Validate file type
        if (!file.name.toLowerCase().endsWith('.xui')) {
            showUploadStatus('Error: Only .xui files are allowed', true);
            return;
        }

        // Validate file size (5MB max)
        if (file.size > 5 * 1024 * 1024) {
            showUploadStatus('Error: File size must be less than 5MB', true);
            return;
        }

        // Create FormData and append file
        const formData = new FormData();
        formData.append('xuiFile', file);
        formData.append('action', 'upload-xui');

        // Show loading status
        showUploadStatus('Uploading...', false);

        // Send file to server
        $.ajax({
            url: 'saveXUI.php',
            type: 'POST',
            data: formData,
            processData: false,
            contentType: false,
            success: function(response) {
                try {
                    const result = typeof response === 'string' ? JSON.parse(response) : response;
                    
                    if (result.success) {
                        showUploadStatus('File uploaded successfully!', false);
                        // Reload the page with the new file
                        window.location.href = window.location.pathname + '?xui_file=' + result.filename;
                    } else {
                        showUploadStatus('Error: ' + (result.message || 'Upload failed'), true);
                    }
                } catch (e) {
                    showUploadStatus('Error: Invalid server response', true);
                }
            },
            error: function(xhr, status, error) {
                showUploadStatus('Error: ' + error, true);
            }
        });

        // Clear the file input
        $(this).val('');
    });

    function showUploadStatus(message, isError) {
        const statusDiv = $("#uploadStatus");
        statusDiv.text(message);
        statusDiv.css('color', isError ? 'red' : 'green');
    }
});


(function(window, undefined) {
    'use strict';
    
    // Prevent console access
    const _log = console.log;
    console.log = function() {};
    
    // Disable right-click
    document.addEventListener('contextmenu', e => e.preventDefault());

    // Your existing code here...
    
})(window);