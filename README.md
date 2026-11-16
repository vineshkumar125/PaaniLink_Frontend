# PaaniLink – Phase 1 Frontend

A responsive frontend prototype for the Water Tanker Booking and Dispatch System.

## Requirements
- Node.js and npm
- A modern browser

## Run the mock API
1. Open this project folder in VS Code.
2. Open the terminal in this folder.
3. Run `npm install`.
4. Start the mock API with `npm run mock-api`.
5. Keep that terminal running. JSON Server runs at `http://localhost:3000`.
6. Open `index.html` in your browser (recommended: VS Code Live Server).

## Demo accounts
All passwords are `12345678`.

| Role | Email |
|---|---|
| Customer | customer@paanilink.com |
| Zone Officer | Gulshan.officer@paanilink.com || north.officer@paanilink.com || Clifton.officer@paanilink.com |
| Hydrant Operator | operator@paanilink.com |
| Driver | driver@paanilink.com |
| Administrator | admin@paanilink.com |

## Frontend features
- Login and customer registration
- Customer booking, cancellation, booking history, subsidy application, delivery confirmation and dispute
- Zone Officer subsidy application review and booking approval/rejection
- Hydrant Operator booking view, tanker/driver assignment, filled/departed actions and availability management
- Driver trip list and Arrived/Delivered/Failed updates
- Administrator overview and management of zones, hydrants, tankers, rates and user accounts
- Fetch API for reading and updating mock API data
- Responsive layouts, labelled forms and client-side validation

## Important note
This is Phase 1 only. The demo login is frontend-only and is not secure authentication. Business rules are demonstrated in the interface; Phase 2 must enforce all important rules on the backend and database, including transactions and concurrency protection.
