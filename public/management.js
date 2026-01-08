const personaSelect = document.getElementById("personaSelect");
const jsonData = document.getElementById("jsonData");
const downloadTemplate = document.getElementById("downloadTemplate");
const newCharacterButton = document.getElementById("newCharacter");
const uploadForm = document.getElementById("uploadForm");
const personaIdInput = document.getElementById("personaId");
const personaImageInput = document.getElementById("personaImage");
const personaImagePreview = document.getElementById("personaImagePreview");

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
    if (personaId) {
        try {
            const response = await fetch(`/api/personas/${personaId}/full-data`);
            const data = await response.json();
            jsonData.value = JSON.stringify(data, null, 2);
            if (data.persona?.image) {
                personaImagePreview.src = data.persona.image;
                personaImagePreview.style.display = "block";
            } else {
                personaImagePreview.src = "";
                personaImagePreview.style.display = "none";
            }
        } catch (error) {
            console.error("Failed to load character data:", error);
        }
    } else {
        jsonData.value = "";
        personaImageInput.value = "";
        personaImagePreview.src = "";
        personaImagePreview.style.display = "none";
    }
});

newCharacterButton.addEventListener("click", async () => {
    personaSelect.value = "";
    personaIdInput.value = "";
    personaImageInput.value = "";
    personaImagePreview.src = "";
    personaImagePreview.style.display = "none";
    try {
        const response = await fetch("/api/character-template");
        const template = await response.json();
        jsonData.value = JSON.stringify(template, null, 2);
    } catch (error) {
        console.error("Failed to load character template:", error);
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

personaImageInput.addEventListener("change", () => {
    const file = personaImageInput.files?.[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = () => {
            personaImagePreview.src = reader.result;
            personaImagePreview.style.display = "block";
        };
        reader.readAsDataURL(file);
    } else {
        personaImagePreview.src = "";
        personaImagePreview.style.display = "none";
    }
});

async function uploadPersonaImage(personaId, file) {
    const response = await fetch(`/api/personas/${personaId}/image`, {
        method: "PUT",
        headers: {
            "Content-Type": file.type,
        },
        body: file,
    });

    if (!response.ok) {
        throw new Error("Failed to upload persona image");
    }

    return response.json();
}

uploadForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = new FormData(uploadForm);
    const jsonFile = formData.get("jsonFile");
    const personaImageFile = formData.get("persona_image");
    const readFileAsText = (file) => new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(reader.error);
        reader.readAsText(file);
    });
    try {
        const jsonText = await readFileAsText(jsonFile);
        const data = JSON.parse(jsonText);
        const personaId = formData.get("persona_id");
        if (personaId) {
            data.persona_id = personaId;
        }

        const response = await fetch("/api/character-data/update", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(data),
        });

        const result = await response.json();

        if (response.ok) {
            const savedPersonaId = result.persona_id;
            if (personaImageFile && personaImageFile.size > 0) {
                const imageResult = await uploadPersonaImage(savedPersonaId, personaImageFile);
                personaImagePreview.src = imageResult.image;
                personaImagePreview.style.display = "block";
            }
            alert("Character data updated successfully!");
            await loadPersonas();
            personaSelect.value = savedPersonaId;
            personaSelect.dispatchEvent(new Event("change"));
        } else {
            alert("Failed to update character data.");
        }
    } catch (error) {
        console.error("Failed to update character data:", error);
        alert("Failed to update character data.");
    }
});

loadPersonas();
