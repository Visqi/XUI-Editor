<?php


function traverseArray($element, &$result, $level = 0, $key = null)
{
    if (is_array($element)) {
        if (isset($element['@attributes'])) {
            $processed = processObject($element, $level, $key);
            $result[$level][] = $processed;
        } else {
            foreach ($element as $subKey => $subElement) {
                traverseArray($subElement, $result, $level, $key);
            }
        }
    }

    if (isset($element['child'])) {
        foreach ($element['child'] as $childKey => $child) {
            traverseArray($child, $result, $level + 1, $childKey);
        }
    }
}

function processObject($obj, $level, $elementKey = null)
{
    $keyOutput = $elementKey ? " (Key: $elementKey)" : "";
    if (isset($obj['@attributes']) && isset($obj['@attributes']['name'])) {
        $name = $obj['@attributes']['name'];

        return parseXUIElement($obj, $level, $elementKey);
    }
}

function traverseArrayNonSorted($element, $level = 0, $key = null)
{
    $result = [];
    if (is_array($element)) {
        foreach ($element as $subKey => $subElement) {
            if (is_array($subElement)) {
                // Here, we differentiate between associative and sequential arrays differently.
                if (array_keys($subElement) !== range(0, count($subElement) - 1)) {
                    // Associative array: treat as a single object.
                    $result[] = processObjectNonSorted($subElement, $level, $subKey);
                } else {
                    // Sequential array: process each item separately.
                    foreach ($subElement as $item) {
                        $result[] = processObjectNonSorted($item, $level, $subKey);
                    }
                }
            }
        }
    }
    return $result;
}

function processObjectNonSorted($obj, $lvl, $elementKey = null)
{
    $keyOutput = $elementKey ? " (Key: $elementKey)" : "";
    $result = [];
    $parsedElement = [];

    if (isset($obj['@attributes']) && isset($obj['@attributes']['name'])) {
        $name = $obj['@attributes']['name'];
        $parsedElement = parseXUIElement($obj, $lvl, $elementKey);
    }

    if (isset($obj['child'])) {
        $children = traverseArrayNonSorted($obj['child'], $lvl + 1);
        $parsedElement['child'] = $children;
    }

    $result[] = $parsedElement;
    return $result;
}
