
# Cron Expression Parser

A script which parses a cron string and expands each field
to show the times at which it will run.

This project is created in Node.js and it will required on your system to run the project.
## Files

- index.js: It takes the command line arguments, call the parse function and renders the table.
- cron.js : A service which exports a Cron class, we will use its parse function to parse our expression.

## How it runs?

node index.js "*/15 0 1,15 * 1-5 /usr/bin/find"


<img width="804" alt="Screenshot 2022-06-08 at 5 26 23 PM" src="https://user-images.githubusercontent.com/60131759/172610451-8c53bd2d-63e9-409e-b8df-c02202c67fc9.png">
