# sushidaw
this was our submission to SOTONHACK 2026!
a browser-based daw, combining two things we love sushi & music.

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
