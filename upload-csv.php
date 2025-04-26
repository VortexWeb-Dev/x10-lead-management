<?php
require_once __DIR__ . "/crest/crest.php";

if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_FILES['csvFile'])) {
    $file = $_FILES['csvFile'];

    if ($file['error'] === UPLOAD_ERR_OK) {
        $fileName    = $file['name'];
        $fileTmpPath = $file['tmp_name'];
        $fileType    = mime_content_type($fileTmpPath);

        if ($fileType === 'text/csv' || pathinfo($fileName, PATHINFO_EXTENSION) === 'csv') {
            if (($handle = fopen($fileTmpPath, 'r')) !== false) {

                //
                // ─── 1) READ & NORMALIZE YOUR HEADERS ────────────────────────────────────────────────
                //
                $rawHeaders = fgetcsv($handle);                   // read first line
                $headers    = array_map('trim', $rawHeaders);     // trim all cells

                // strip UTF-8 BOM on first header, if present
                if (substr($headers[0], 0, 3) === "\xEF\xBB\xBF") {
                    $headers[0] = substr($headers[0], 3);
                }

                // log exactly what PHP thinks your headers are
                error_log("CSV headers: " . json_encode($headers));

                // warn if “Community” isn’t in your header list
                if (! in_array('Community', $headers, true)) {
                    error_log("ERROR: 'Community' header not found. Raw headers: " . json_encode($rawHeaders));
                }

                //
                // ─── 2) LOAD ROWS INTO $data WITH THEIR KEYS ──────────────────────────────────────
                //
                $data     = [];
                $rowCount = 0;
                while (($row = fgetcsv($handle)) !== false) {
                    $rowCount++;
                    $combined = array_combine($headers, $row);
                    $data[]   = $combined;

                    // log what you got for this row, before mapping
                    error_log("Row {$rowCount} input: " . json_encode($combined));
                }
                fclose($handle);


                // your existing mapping stays the same
                $fieldMapping = [
                    "Community"     => "ufCrm40Community",
                    "Project"       => "ufCrm40Project",
                    "Unit"          => "ufCrm40UnitNo",
                    "Type"          => "ufCrm40Type",
                    "Name"          => "ufCrm40Name",
                    "Surname"       => "ufCrm40Surname",
                    "Telephone"     => "ufCrm40Phone",
                    "Property Type" => "ufCrm40PropertyType",
                    "Bedrooms"      => "ufCrm40Bedrooms",
                    "Status"        => "ufCrm40Status",
                    "Notes"         => "ufCrm40Notes",
                ];

                //
                // ─── 3) FOR EACH ROW, BUILD & SEND THE PAYLOAD ────────────────────────────────────
                //
                foreach ($data as $index => $row) {
                    $rowNumber = $index + 1;

                    $itemFields = [
                        'entityTypeId' => 1110,
                        'fields'       => []
                    ];

                    foreach ($fieldMapping as $csvField => $bitrixField) {
                        if (isset($row[$csvField])) {
                            $value = $row[$csvField];

                            if (in_array($bitrixField, ['EMAIL', 'PHONE'])) {
                                $itemFields['fields'][$bitrixField] = [
                                    [
                                        'VALUE'      => $value,
                                        'VALUE_TYPE' => $bitrixField === 'EMAIL' ? 'WORK' : 'MOBILE'
                                    ]
                                ];
                            } else {
                                $itemFields['fields'][$bitrixField] = $value;
                            }
                        }
                    }

                    // LOG the exact fields you’re about to send
                    error_log("Row {$rowNumber} → fields: " . json_encode($itemFields['fields']));

                    // SEND TO BITRIX
                    $response = CRest::call('crm.item.add', $itemFields);

                    // LOG Bitrix’s reply
                    error_log("Row {$rowNumber} → Bitrix response: " . json_encode($response));
                    if (isset($response['error'])) {
                        error_log("Error adding item on row {$rowNumber}: " . json_encode($response));
                    }
                }

                header("Location: index.php");
                exit;
            } else {
                echo "Error: Unable to open the CSV file.";
            }
        } else {
            echo "Error: Please upload a valid CSV file.";
        }
    } else {
        echo "Error: File upload failed with error code " . $file['error'];
    }
} else {
    echo "Error: No file uploaded.";
}
