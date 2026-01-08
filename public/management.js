const personaSelect = document.getElementById("personaSelect");
const jsonData = document.getElementById("jsonData");
const downloadTemplate = document.getElementById("downloadTemplate");
const uploadForm = document.getElementById("uploadForm");
const personaIdInput = document.getElementById("personaId");

let personas = [];

async function loadPersonas() {
    try {
        const response = await fetch("/api/personas");
        personas = await response.json();
        personaSelect.innerHTML = "";
        personas.forEach((persona) => {
            const option = document.createElement("option");
            option.value = persona.id;
            option.textContent = persona.label;
            personaSelect.appendChild(option);
        });
        personaSelect.dispatchEvent(new Event("change"));
    } catch (error) {
        console.error("Failed to load personas:", error);
    }
}

personaSelect.addEventListener("change", async () => {
    const personaId = personaSelect.value;
    personaIdInput.value = personaId;
    try {
        const response = await fetch(`/api/personas/${personaId}/full-data`);
        const data = await response.json();
        jsonData.value = JSON.stringify(data, null, 2);
    } catch (error) {
        console.error("Failed to load character data:", error);
    }
});

downloadTemplate.addEventListener("click", async () => {
    try {
        const response = await fetch("/api/character-template");
        const template = await response.json();
        const blob = new Blob([JSON.stringify(template, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "character-template.json";
        a.click();
        URL.revokeObjectURL(url);
    } catch (error) {
        console.error("Failed to download template:", error);
    }
});

uploadForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = new FormData(uploadForm);
    const jsonFile = formData.get("jsonFile");
    const reader = new FileReader();
    reader.onload = async () => {
        try {
            const data = JSON.parse(reader.result);
            data.persona_id = formData.get("persona_id");
            const response = await fetch("/api/character-data/update", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(data),
            });
            if (response.ok) {
                alert("Character data updated successfully!");
                personaSelect.dispatchEvent(new Event("change"));
            } else {
                alert("Failed to update character data.");
            }
        } catch (error) {
            console.error("Failed to update character data:", error);
            alert("Failed to update character data.");
        }
    };
    reader.readAsText(jsonFile);
});

loadPersonas();
