<?php
session_start();
require "previewFunctions.php";
require "parsingFunctions.php";

/**
 * shop_resell_popup index Problems..
 * result.xui not loading at all?
 * 
 * issues on LABELS example tutorial fail ?? Issues with Alignment? Maybe...
 * issues with moving invisible items
 * if a texture has a label make it modifyable via margin
 */

$doStart = true;

$selectedFile = "";
$_f = "";

if (isset($_GET['xui_file'])) {
    $selectedFile = "xui/" . $_GET['xui_file'];
    $_f = $_GET['xui_file'];
} else {
    $doStart = false;
}

$files = glob('xui/*.xui');
$options = '';
foreach ($files as $file) {
    $filename = basename($file);

    if ($filename == $_f) {
        $options .= "<option value=\"$filename\" selected>$filename</option>";
        continue;
    }

    $options .= "<option value=\"$filename\">$filename</option>";
}



echo "<form method=\"GET\" action=\"index.php\">";
echo "<select name=\"xui_file\">";
echo $options;
echo "</select>";
echo "<button type=\"submit\">Load</button>";
echo "</form>";

if (!$doStart) {
    exit;
}



libxml_use_internal_errors(TRUE);
$objXmlDocument = simplexml_load_file($selectedFile);
if ($objXmlDocument === FALSE) {
    echo "There were errors parsing the XML file.\n";
    foreach (libxml_get_errors() as $error) {
        echo $error->message;
    }
    exit;
}
$objJsonDocument = json_encode($objXmlDocument);
$arrOutput = json_decode($objJsonDocument, TRUE);

$GUI = $arrOutput["gui"];

$MAIN_WINDOW = $GUI;

$parsedXUI = [];

$parsedXUI = traverseArrayNonSorted($MAIN_WINDOW);

$parsedXUI = array_reduce($parsedXUI, function ($carry, $item) {
    return array_merge($carry, $item);
}, []);
?>




<!DOCTYPE html>
<html lang="en">

<head>

    <link rel="stylesheet" href="fonts.css">
    <link rel="stylesheet" href="/libs/jstree/themes/default/style.min.css">
    <link rel="stylesheet" href="/libs/fontawesome/css/all.min.css">
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css"
        integrity="sha384-QWTKZyjpPEjISv5WaRU9OFeRpok6YctnYmDr5pNlyT2bRjXh0JMhjY6hW+ALEwIH" crossorigin="anonymous">
    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js"
        integrity="sha384-YvpcrYf0tY3lHB60NNkmXc5s9fDVZLESaAA55NDzOxhy9GkcIdslK1eN7N6jIeHz"
        crossorigin="anonymous"></script>

    <script>
        var parsedXUI = JSON.parse(`<?php echo json_encode($parsedXUI, JSON_HEX_APOS); ?>`);
        const xuiFile = "<?php echo $_GET['xui_file']; ?>";
    </script>
    <script src="/libs/jquery.js"></script>
    <script src="/libs/pixi/pixi.js"></script>
    <script src="/libs/jstree/jstree.min.js"></script>
    <script src="index.js?<?php echo time(); ?>"></script>

</head>

<style>
    .tree-xui-enabled {}

    .tree-xui-disabled {
        opacity: 0.5;
        font-style: italic;
    }
</style>

<body>
    <div style="display: flex; gap: 10px;">
        <div id="app"></div>

        <div id="treeview"></div>
    </div>

    <button id="test">SAVE</button>



    <div class="offcanvas offcanvas-end" data-bs-scroll="true" data-bs-backdrop="false" tabindex="-1"
        id="offcanvasScrolling" aria-labelledby="offcanvasScrollingLabel">
        <div class="offcanvas-header">
            <h5 class="offcanvas-title" id="offcanvasScrollingLabel">Element Editting</h5>
            <button type="button" class="btn-close text-reset" data-bs-dismiss="offcanvas" aria-label="Close"></button>
        </div>
        <div class="offcanvas-body" id="editting-body">

            <div id="element-editting">

                <input type="text" id="identifier" class="form-control" readonly disabled>

                <label for="element-name">Name</label>
                <input type="text" id="element-name" class="form-control" readonly disabled>

                <br/>

                <input type="checkbox" id="element-visible" class="form-check-input">
                <label for="element-visible">Visibility (Global)</label>

                <br/>

                <input type="checkbox" id="element-visible-local" class="form-check-input">
                <label for="element-visible-local">Visibility (Local View Only)</label>


                <br/>

                <input type="checkbox" id="element-enabled" class="form-check-input">
                <label for="element-enabled">Enabled (Global)</label>

                <br/>

                <input type="checkbox" id="element-enabled-local" class="form-check-input">
                <label for="element-enabled-local">Enabled (Local View Only)</label>


                <br/><br/>

                <h5>Position</h5>
            
                <label for="element-global-left">X</label>
                <input type="number" id="element-global-left" data-direction="left" class="form-control global-position">

                <label style="" for="element-global-right">Width (going under the X values flips the element. X is basically the 0 point)</label>
                <input style="" type="number" id="element-global-right" data-direction="right" class="form-control global-position">

                <label for="element-global-top">Y</label>
                <input type="number" id="element-global-top" data-direction="top" class="form-control global-position">

                <label style="" for="element-global-bottom">Height (going under the Y values flips the element. Y is basically the 0 point)</label>
                <input style="" type="number" id="element-global-bottom" data-direction="bottom" class="form-control global-position" >


                <h5 style="display:none;">Local Position</h5>

                <label style="display:none;" for="element-local-left">Left</label>
                <input style="display:none;" type="number" id="element-local-left" data-direction="left" class="form-control local-position">

                <label style="display:none;" for="element-local-right">Right</label>
                <input style="display:none;" type="number" id="element-local-right" data-direction="right" class="form-control local-position" disabled>

                <label style="display:none;" for="element-local-top">Top</label>
                <input style="display:none;" type="number" id="element-local-top" data-direction="top" class="form-control local-position">

                <label style="display:none;" for="element-local-bottom">Bottom</label>
                <input style="display:none;" type="number" id="element-local-bottom" data-direction="bottom" class="form-control local-position" disabled>

                <br/>

                <div id="element-textures">

                </div>

            </div>

        </div>
    </div>
</body>

</html>