# sushidaw
this was our submission to SOTONHACK 2026!
a browser-based daw, combining two things we love sushi & music.

## dark mode
<img width="1847" height="1041" alt="Screenshot 2026-03-30 at 15-25-02 SushiDAW" src="https://github.com/user-attachments/assets/04d136d4-0cc8-4424-b276-16cfa61214a5" />

## light mode
<img width="1847" height="1041" alt="Screenshot 2026-03-30 at 15-25-14 SushiDAW" src="https://github.com/user-attachments/assets/39989dcb-59bd-4e17-adaf-4ddd6cd0d717" />

## producer tag
<img width="1847" height="1041" alt="Screenshot 2026-03-30 at 15-25-58 SushiDAW" src="https://github.com/user-attachments/assets/e6230698-08e7-4dac-8871-a896da385d09" />

## backend setup

requires java 17+ and mongodb. 

1. navigate to the `backend` directory.
2. set your environment variables:
   - `MONGO_URI`: mongodb connection string
   - `JWT_SECRET`: secret for token generation
   - `JWT_ISSUER`: jwt issuer string
   - `JWT_AUDIENCE`: jwt audience string
   - `PORT`: port to run the server on (default: 3000)
3. build and run the ktor server:
   ```bash
   ./gradlew run
   ```

## frontend setup

frontend uses static files and vercel serverless functions for ai generation.

 1. set your api keys in your environment:

        GEMINI_KEY: google gemini api key

        GROQ_KEY: groq api key

        ELEVENLABS_KEY: elevenlabs api key

 2. serve the root directory locally. if using vercel cli:
    ```bash
    vercel dev
    ```

    otherwise, use a basic web server:
    ```bash
    python -m http.server 8080
    ```

also make sure window.SUSHIDAW_API in index.html points to your backend instance.
