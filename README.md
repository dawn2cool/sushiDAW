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
