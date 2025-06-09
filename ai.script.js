const promptInput = document.getElementById('promptInput');
const generateImageBtn = document.getElementById('generateImageBtn');
const imageDisplay = document.getElementById('imageDisplay');
const generatedImage = document.getElementById('generatedImage');
const loadingSpinner = document.getElementById('loadingSpinner');
const placeholderText = document.getElementById('placeholderText');
const errorMessage = document.getElementById('errorMessage');

generateImageBtn.addEventListener('click', async () => {
    const prompt = promptInput.value.trim();
    if (!prompt) {
        showError('Please enter a prompt to generate an image.');
        return;
    }

    // Clear previous states
    generatedImage.style.display = 'none';
    generatedImage.src = '';
    placeholderText.style.display = 'none';
    hideError();
    loadingSpinner.style.display = 'block'; // Show spinner

    // --- Mock API Call (Replace with actual API integration) ---
    // In a real application, you would make an API call to a service
    // like Stability AI, DALL-E, or Hugging Face.
    // Example using a placeholder:
    const mockApiUrl = 'https://via.placeholder.com/400x400?text=' + encodeURIComponent(prompt.substring(0, 50)); // Simulates an image based on prompt

    try {
        // Simulate network delay
        await new Promise(resolve => setTimeout(resolve, 2000));

        // For a real API, this would be a fetch request:
        /*
        const response = await fetch('YOUR_IMAGE_GENERATION_API_ENDPOINT', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer YOUR_API_KEY' // IMPORTANT: In a real app, do this on a server!
            },
            body: JSON.stringify({ prompt: prompt, /* other parameters like size, style * / })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Failed to generate image');
        }

        // Assuming the API returns a direct image URL or base64 encoded image
        // For base64: const data = await response.json(); generatedImage.src = `data:image/png;base64,${data.image}`;
        // For direct URL: const imageUrl = await response.text(); generatedImage.src = imageUrl;
        */

        generatedImage.src = mockApiUrl; // Use mock URL for demo
        generatedImage.style.display = 'block';
        imageDisplay.style.backgroundColor = 'transparent'; // Remove background once image loads

    } catch (error) {
        console.error('Image generation error:', error);
        showError('Error generating image: ' + error.message);
        placeholderText.style.display = 'block'; // Show placeholder on error
        imageDisplay.style.backgroundColor = 'var(--accent-dark)'; // Restore background
    } finally {
        loadingSpinner.style.display = 'none'; // Hide spinner
    }
});

function showError(message) {
    errorMessage.textContent = message;
    errorMessage.style.display = 'block';
}

function hideError() {
    errorMessage.style.display = 'none';
    errorMessage.textContent = '';
}
