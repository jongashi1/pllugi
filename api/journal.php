<?php
header("Content-Type: application/json; charset=utf-8");

$password = getenv("JOURNAL_PASSWORD") ?: "Kevpatty";
$providedPassword = $_SERVER["HTTP_X_JOURNAL_PASSWORD"] ?? "";
$dataDir = dirname(__DIR__) . DIRECTORY_SEPARATOR . "data";
$dataFile = $dataDir . DIRECTORY_SEPARATOR . "journal-entries.json";

function send_json($statusCode, $data) {
    http_response_code($statusCode);
    echo json_encode($data);
    exit;
}

function ensure_data_file($dataDir, $dataFile) {
    if (!is_dir($dataDir)) {
        mkdir($dataDir, 0755, true);
    }

    if (!file_exists($dataFile)) {
        file_put_contents($dataFile, json_encode(["entries" => []], JSON_PRETTY_PRINT));
    }
}

function read_entries($dataDir, $dataFile) {
    ensure_data_file($dataDir, $dataFile);
    $data = json_decode(file_get_contents($dataFile), true);
    return $data["entries"] ?? [];
}

function write_entries($dataDir, $dataFile, $entries) {
    ensure_data_file($dataDir, $dataFile);
    file_put_contents($dataFile, json_encode(["entries" => $entries], JSON_PRETTY_PRINT));
}

if ($providedPassword !== $password) {
    send_json(401, ["error" => "Unauthorized"]);
}

$method = $_SERVER["REQUEST_METHOD"];

if ($method === "GET") {
    send_json(200, ["entries" => read_entries($dataDir, $dataFile)]);
}

if ($method === "POST") {
    $now = gmdate("c");
    $body = json_decode(file_get_contents("php://input"), true) ?: [];
    $entries = read_entries($dataDir, $dataFile);
    $entryId = $body["id"] ?? bin2hex(random_bytes(16));
    $entry = [
        "id" => $entryId,
        "title" => (string)($body["title"] ?? ""),
        "body" => (string)($body["body"] ?? ""),
        "updatedAt" => $now
    ];
    $existingIndex = -1;

    foreach ($entries as $index => $existingEntry) {
        if (($existingEntry["id"] ?? "") === $entryId) {
            $existingIndex = $index;
            break;
        }
    }

    if ($existingIndex >= 0) {
        $entry["createdAt"] = $entries[$existingIndex]["createdAt"] ?? $now;
        $entries[$existingIndex] = $entry;
    } else {
        $entry["createdAt"] = $now;
        array_unshift($entries, $entry);
    }

    usort($entries, function ($a, $b) {
        return strtotime($b["updatedAt"] ?? "") <=> strtotime($a["updatedAt"] ?? "");
    });

    write_entries($dataDir, $dataFile, $entries);
    send_json(200, ["entry" => $entry, "entries" => $entries]);
}

if ($method === "DELETE") {
    $entryId = $_GET["id"] ?? "";
    $entries = read_entries($dataDir, $dataFile);
    $filteredEntries = array_values(array_filter($entries, function ($entry) use ($entryId) {
        return ($entry["id"] ?? "") !== $entryId;
    }));

    if (count($filteredEntries) === count($entries)) {
        send_json(404, ["error" => "Entry not found"]);
    }

    write_entries($dataDir, $dataFile, $filteredEntries);
    send_json(200, ["entries" => $filteredEntries]);
}

send_json(405, ["error" => "Method not allowed"]);
