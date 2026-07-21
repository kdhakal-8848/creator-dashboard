(async () => {
    try {
        const response = await fetch('https://loksewa-backend-ah2s.onrender.com/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ topic: "Test topic 123", contentType: "Fact", promptTemplate: "" })
        });
        const data = await response.json();
        console.log("Response:", JSON.stringify(data, null, 2));
    } catch (e) {
        console.error(e);
    }
})();
