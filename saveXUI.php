<?php

$action = $_POST['action'];

switch ($action) {
    case 'save-json':
        saveXUI($_POST['xui'], $_POST['elements']);
        break;
    case 'upload-xui':
        handleXUIUpload();
        break;
    default:
        echo "Invalid action.";
        break;
}


function saveXUI($xuiName, $json) {
    $json = json_decode($json, true);

    $xuiFile = "xui/" . $xuiName;

    // Copy the original file to a new version and modify that one
    $newXuiFile = "xui/new_" . $xuiName;

    copy($xuiFile, $newXuiFile);

    $objXmlDocument = simplexml_load_file($newXuiFile);

    updatePositions($objXmlDocument->gui, $json, true);

    $objXmlDocument->asXML($newXuiFile);

    echo "XUI file saved successfully.";
}

function updatePositions(&$xmlElement, $jsonElement, $isRoot = true) 
{

    if ($isRoot) {
        $arrayEntry = $jsonElement[0]["element"];
    } else {
        $arrayEntry = $jsonElement[0];
    }

 //  print_r($arrayEntry);

    foreach ($xmlElement->children() as $type => $child) {
        $key = $type;
        $name = (string)$child['name'];

       //print_r($key . " " . $name);
       //print_r("<br>");


        if ($key == $arrayEntry["key"] && $name == $arrayEntry["name"]) {

            $child->global->attributes()->left = $arrayEntry["position_global"]["left"];
            $child->global->attributes()->right = $arrayEntry["position_global"]["right"];
            $child->global->attributes()->top = $arrayEntry["position_global"]["top"];
            $child->global->attributes()->bottom = $arrayEntry["position_global"]["bottom"];

            $child->local->attributes()->left = $arrayEntry["position_local"]["left"];
            $child->local->attributes()->right = $arrayEntry["position_local"]["right"];
            $child->local->attributes()->top = $arrayEntry["position_local"]["top"];
            $child->local->attributes()->bottom = $arrayEntry["position_local"]["bottom"];

            $child->show->attributes()->value = $arrayEntry["show"] == 1 ? "true" : "false";
            $child->enable->attributes()->value = $arrayEntry["enable"] == 1 ? "true" : "false";

            $children = $child->child;

            foreach ($children as $childElement) {

                foreach($arrayEntry["child"] as $jsonChild) {
                    updatePositions($childElement, $jsonChild, false);
                }
            }
        }
    }
}

function handleXUIUpload() {
    $response = array('success' => false, 'message' => '');
    
    try {
        // Check if file was uploaded
        if (!isset($_FILES['xuiFile'])) {
            throw new Exception('No file was uploaded');
        }

        $file = $_FILES['xuiFile'];
        
        // Basic error checking
        if ($file['error'] !== UPLOAD_ERR_OK) {
            throw new Exception('File upload error: ' . $file['error']);
        }

        // Verify file size (max 5MB)
        if ($file['size'] > 5 * 1024 * 1024) {
            throw new Exception('File is too large. Maximum size is 5MB');
        }

        // Get file extension and verify it's an XUI file
        $fileInfo = pathinfo($file['name']);
        $extension = strtolower($fileInfo['extension']);
        
        if ($extension !== 'xui') {
            throw new Exception('Invalid file type. Only .xui files are allowed');
        }

        // Verify file content
        $content = file_get_contents($file['tmp_name']);
        if (!isValidXML($content)) {
            throw new Exception('Invalid XUI file format');
        }

        // Generate safe filename
        $safeName = preg_replace('/[^a-zA-Z0-9_-]/', '', $fileInfo['filename']);
        $safeName = $safeName . '_' . time() . '.xui';
        
        // Move file to xui directory
        $uploadPath = 'xui/' . $safeName;
        
        // Check if directory exists and is writable
        if (!file_exists('xui')) {
            if (!mkdir('xui', 0775, true)) {
                $error = error_get_last();
                throw new Exception(sprintf(
                    'Failed to create upload directory. Error: %s. Current working directory: %s',
                    $error ? $error['message'] : 'Unknown error',
                    getcwd()
                ));
            }
            // Try to set group to www-data
            $webServerGroup = 'www-data';
            chgrp('xui', $webServerGroup);
        }

        // Get directory information based on OS
        $isWindows = strtoupper(substr(PHP_OS, 0, 3)) === 'WIN';
        $dirDetails = '';

        if ($isWindows) {
            // Windows-specific checks
            $dirDetails = sprintf(
                'Directory: %s, Permissions: %s',
                realpath('xui'),
                decoct(fileperms('xui') & 0777)
            );
        } else {
            // Unix/Linux-specific checks
            $dirOwner = posix_getpwuid(fileowner('xui'));
            $dirGroup = posix_getgrgid(filegroup('xui'));
            $currentUser = posix_getpwuid(posix_geteuid());
            
            $dirDetails = sprintf(
                'Directory: %s, Permissions: %s, Owner: %s, Group: %s, Current PHP user: %s',
                realpath('xui'),
                decoct(fileperms('xui') & 0777),
                $dirOwner['name'] ?? 'unknown',
                $dirGroup['name'] ?? 'unknown',
                $currentUser['name'] ?? 'unknown'
            );

            // If directory exists but isn't writable, try to fix permissions
            if (file_exists('xui') && !is_writable('xui')) {
                // Try to set group to www-data if not already
                if ($dirGroup['name'] !== 'www-data') {
                    @chgrp('xui', 'www-data');
                }
                
                // Set group write permissions
                $currentPerms = fileperms('xui') & 0777;
                $newPerms = $currentPerms | 0775; // Add group write permission
                @chmod('xui', $newPerms);
                
                // If still not writable, provide specific instructions
                if (!is_writable('xui')) {
                    throw new Exception(
                        'Upload directory is not writable. Please run these commands as root:' . PHP_EOL .
                        'sudo chown ' . $dirOwner['name'] . ':www-data ' . realpath('xui') . PHP_EOL .
                        'sudo chmod 775 ' . realpath('xui')
                    );
                }
            }
        }

        if (!is_writable('xui')) {
            if ($isWindows) {
                throw new Exception(
                    'Upload directory is not writable. Details: ' . $dirDetails . 
                    '. Please ensure the web server has write permissions to the xui directory.'
                );
            } else {
                throw new Exception(
                    'Upload directory is not writable. Please run these commands as root:' . PHP_EOL .
                    'sudo chown ' . $dirOwner['name'] . ':www-data ' . realpath('xui') . PHP_EOL .
                    'sudo chmod 775 ' . realpath('xui')
                );
            }
        }

        // Set directory permissions
        if ($isWindows) {
            // On Windows, we need to use icacls or cacls
            $xuiPath = realpath('xui');
            exec("icacls \"$xuiPath\" /grant Everyone:F");
        }

        // Try to move the file and get detailed error if it fails
        if (!move_uploaded_file($file['tmp_name'], $uploadPath)) {
            $error = error_get_last();
            $errorDetails = sprintf(
                'Failed to move uploaded file. Details: %s. File permissions: %s. Upload path: %s. PHP has write permission: %s',
                $error ? $error['message'] : 'Unknown error',
                file_exists($file['tmp_name']) ? decoct(fileperms($file['tmp_name']) & 0777) : 'N/A',
                $uploadPath,
                is_writable('xui') ? 'Yes' : 'No'
            );
            throw new Exception($errorDetails);
        }

        // Verify the file was actually created
        if (!file_exists($uploadPath)) {
            throw new Exception('File was moved but cannot be found at destination');
        }

        $response['success'] = true;
        $response['message'] = 'File uploaded successfully';
        $response['filename'] = $safeName;
    } catch (Exception $e) {
        $response['message'] = $e->getMessage();
    }

    // Return JSON response
    header('Content-Type: application/json');
    echo json_encode($response);
}

function isValidXML($content) {
    // Disable external entity loading
    libxml_disable_entity_loader(true);
    
    // Previous value
    $previousValue = libxml_use_internal_errors(true);
    
    try {
        $doc = simplexml_load_string($content);
        if ($doc === false) {
            return false;
        }
        
        // Check for required XUI structure
        if (!isset($doc->gui)) {
            return false;
        }
        
        return true;
    } catch (Exception $e) {
        return false;
    } finally {
        // Restore previous value
        libxml_use_internal_errors($previousValue);
    }
}
