<?php

function parseXUIElement($object, $level, $key)
{

    $texData = [];

    if (isset($object["gui_skin"])) {
        if ($object["gui_skin"]["@attributes"]["texture"] != "") {

            $_tex = convertTextureName($object["gui_skin"]["@attributes"]["texture"]);
            
            $texData[] = [
                "left" => $object["gui_skin"]["@attributes"]["left"],
                "right" => $object["gui_skin"]["@attributes"]["right"],
                "top" => $object["gui_skin"]["@attributes"]["top"],
                "bottom" => $object["gui_skin"]["@attributes"]["bottom"],
                "texture" => $_tex,
                "flipType" => $object["gui_skin"]["@attributes"]["flip_type"],
                "blendType" => $object["gui_skin"]["@attributes"]["blend_type"],
            ];
        }
    }

    for ($i = 0; $i < 20; $i++) {
        if (isset($object["gui_skin_{$i}"])) {
            if ($object["gui_skin_{$i}"]["@attributes"]["texture"] != "") {

                $_tex =  convertTextureName($object["gui_skin_{$i}"]["@attributes"]["texture"]);

                $texData[] = [
                    "left" => $object["gui_skin_{$i}"]["@attributes"]["left"],
                    "right" => $object["gui_skin_{$i}"]["@attributes"]["right"],
                    "top" => $object["gui_skin_{$i}"]["@attributes"]["top"],
                    "bottom" => $object["gui_skin_{$i}"]["@attributes"]["bottom"],
                    "texture" => $_tex,
                    "flipType" => $object["gui_skin_{$i}"]["@attributes"]["flip_type"],
                    "blendType" => $object["gui_skin_{$i}"]["@attributes"]["blend_type"],
                ];
            }
        }
    }

    $labelSettings = [
        "label" => isset($object["string"]["eng"]["@attributes"]["value"]) ? $object["string"]["eng"]["@attributes"]["value"] : "",
        "fontStyle" => isset($object["font_style"]["@attributes"]["value"]) ? $object["font_style"]["@attributes"]["value"] : "",
        "font" => isset($object["font"]["@attributes"]["value"]) ? $object["font"]["@attributes"]["value"] : "",
        "textAlign" => isset($object["text_align"]["@attributes"]["value"]) ? $object["text_align"]["@attributes"]["value"] : "",
        "color" => isset($object["color_0"]["@attributes"]["base_color"]) ? $object["color_0"]["@attributes"]["base_color"] : "",
        "margin_x" => isset($object["text_margin"]["@attributes"]["x"]) ? $object["text_margin"]["@attributes"]["x"] : "",
        "margin_y" => isset($object["text_margin"]["@attributes"]["y"]) ? $object["text_margin"]["@attributes"]["y"] : "",
    ];

    $elementData = [
        "identifier" => md5(uniqid()),
        "key" => $key,
        "level" => $level,
        "name" => $object["@attributes"]["name"],
        "enable" => $object["enable"]["@attributes"]["value"] == "true",
        "show" => $object["show"]["@attributes"]["value"] == "true",
        "opactiy" => $object["opacity"]["@attributes"]["value"],
        "intersect" => $object["intersect"]["@attributes"]["value"] == "true",
        "position_local" => [
            "left" => $object["local"]["@attributes"]["left"],
            "right" => $object["local"]["@attributes"]["right"],
            "top" => $object["local"]["@attributes"]["top"],
            "bottom" => $object["local"]["@attributes"]["bottom"],
        ],
        "position_local_origin" => [
            "left" => $object["local"]["@attributes"]["left"],
            "right" => $object["local"]["@attributes"]["right"],
            "top" => $object["local"]["@attributes"]["top"],
            "bottom" => $object["local"]["@attributes"]["bottom"],
        ],
        "position_global" => [
            "left" => $object["global"]["@attributes"]["left"],
            "right" => $object["global"]["@attributes"]["right"],
            "top" => $object["global"]["@attributes"]["top"],
            "bottom" => $object["global"]["@attributes"]["bottom"],
        ],
        "position_global_origin" => [
            "left" => $object["global"]["@attributes"]["left"],
            "right" => $object["global"]["@attributes"]["right"],
            "top" => $object["global"]["@attributes"]["top"],
            "bottom" => $object["global"]["@attributes"]["bottom"],
        ],
        "textures" => $texData,
        "label" => $labelSettings,
    ];

    return $elementData;

}

function convertTextureName($textureName)
{
    if ($textureName == "")
        return $textureName;

    $_tmp = $textureName;

    $textureName = str_replace("_rc", "_eu", $textureName);
    $textureName = str_replace("_lac", "_eu", $textureName);

    if (!file_exists("textures/" . $textureName)) {
        $textureName = str_replace(".dds", ".tga", $textureName);
    }

    if (!file_exists("textures/" . $textureName)) {
        $textureName = str_replace(".tga", ".png", $textureName);
    }

    if (!file_exists("textures/" . $textureName)) {
        $textureName = "COULD NOT FIND TEXTURE -> " . $_tmp;
    }

    return $textureName;
}