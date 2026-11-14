# Academic Assessment Report: Login & Session State Management System
**Course Modules:** Full-Stack Web Development & Finite Automata / Formal Languages & Computer Networks  
**Target Deployments:** Frontend on **Vercel** | Backend on **Render** | Database on **MongoDB Atlas**  

---

## PART 1: FULL-STACK WEB DEVELOPMENT OUTCOMES (CO1 – CO5)

### CO1: Web Page Design and Validation [Marks: 2]
> **Question:** Design a basic web page to enter the required details for the proposed application. Validate the input fields and display the entered details.

#### 1. Design & UI Implementation:
The authentication portal is designed using modern responsive layouts (React 18 + Tailwind CSS) inside `/login` and `/register`:
* **Input Fields:**
  * **Email Address:** Decorated with interactive focus states, iconography (`Mail`), and real-time syntax checking.
  * **Password:** Configured with masked/unmasked toggle (`Eye` / `EyeOff`), character length counter, and instant visual feedback.
  * **Username (Registration):** Validates alphanumeric characters and handles 3–20 character limits.

#### 2. Input Validation Rules:
* **Client-Side Validation (`Login.jsx`, `Register.jsx`):**
  * Ensures mandatory fields are not empty before firing network requests.
  * Evaluates email using RFC 5322 regex: `^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$`.
  * Verifies password complexity: Minimum 8 characters, at least 1 uppercase letter, 1 lowercase letter, 1 number, and 1 special symbol (`@$!%*?&#^`).
* **Server-Side Validation Middleware (`validationMiddleware.js`):**
  * Re-verifies all client payloads using strict regex before handing requests to controllers, returning HTTP `400 Bad Request` on mismatch.

#### 3. Display of Entered Details:
* Both `/login` and `/register` include a dedicated **"CO1: Display Entered Details"** live reflection panel.
* As the user types, the panel reflects the current values of `email`, masked `password`, length, regex syntax compliance badge, and current FSM state (`LOGGED_OUT`, `AUTHENTICATING`).

---

### CO2: Full-Stack Architecture and Communication [Marks: 2]
> **Question:** Explain the architecture of the proposed system using a browser, React frontend, Node.js/Express backend, and MongoDB database. Describe how these components communicate to process user requests and manage application data.

#### 1. Architectural Tiers:
```
[Browser Client]
       │
       ▼  (Virtual DOM / React Context API)
[React Frontend (Vercel)]
       │
       ▼  HTTP REST APIs / JSON / Bearer JWT (Network Layer)
[Node.js + Express Backend (Render)]
       │
       ├─► [SecurityEventHub (EventEmitter)] -> Event Listeners
       │
       ▼  Mongoose ODM (Driver Layer)
[MongoDB Database (Atlas / In-Memory Fallback)]
```

#### 2. Component Communication Workflow:
1. **Request Dispatch:** User enters credentials in React. The form triggers Axios which packages an HTTP `POST` request with JSON payload `{ email, password }` directed to `/api/auth/login`.
2. **Reverse Proxy & Routing:** On Render, Express receives the request. The `networkLogger` middleware records the client IP (`X-Forwarded-For`), HTTP headers, and starts a high-resolution latency timer.
3. **Authentication Processing:** Express queries MongoDB via Mongoose:
   `User.findOne({ email })`.
   Bcrypt compares the raw password against the stored bcrypt hash (`$2a$10$...`).
4. **Session Minting:** Upon verification, Express creates a cryptographically signed JWT containing `{ userId, sessionId }` and inserts a new document into the `Session` collection.
5. **Response & State Transition:** Express returns HTTP `200 OK` with token and session payload. React stores the JWT in `localStorage`, updates `AuthContext`, transitions the FSM state to `LOGGED_IN`, and redirects the user to `/dashboard`.

---

### CO3: React Components, State Management and Routing [Marks: 2]
> **Question:** Develop a React dashboard using suitable components and state management to display application records, status information, and notifications. Explain how React Router can be used to navigate between the dashboard and other application pages.

#### 1. Component Decomposition in Dashboard (`Dashboard.jsx`):
* **`FsmStateIndicator`:** Visual pill displaying current FSM state with glowing animated rings.
* **`TTLCountdownProgressBar`:** Dynamic circular/linear progress bar tracking remaining session time (300s default).
* **`SessionRecordTable`:** Displays all stored session documents, device/IP, status, and Mongoose CRUD revoke actions.
* **`SecurityEventCard`:** Displays live notifications dispatched from the Node.js event listener via Server-Sent Events (SSE).

#### 2. State Management Architecture:
* Handled through a centralized **React Context (`AuthContext.jsx`)**:
  * Tracks global state: `user`, `session`, `fsmState`, `remainingSeconds`, `lockoutDetails`, and `stateHistory`.
  * Provides global action functions: `login()`, `logout()`, `renewSession()`, and `resetLockout()`.
  * Runs a 1-second interval timer that triggers state transition to `SESSION_EXPIRED` when `remainingSeconds <= 0`.

#### 3. React Router Navigation (`App.jsx`):
* **Declarative Routes:**
  * Public routes: `/` (Home), `/login`, `/register`, `/fsm-visualizer`, `/theory-lab`, `/network-inspector`, `/docs`.
  * Protected route: `/dashboard`.
* **Guarded Navigation via `<ProtectedRoute>`:**
  ```jsx
  export const ProtectedRoute = ({ children }) => {
    const { fsmState } = useAuth();
    if (fsmState !== 'LOGGED_IN') {
      return <Navigate to="/login" replace />;
    }
    return children;
  };
  ```
  If a user logs out or the session expires, `<ProtectedRoute>` instantly intercepts the route change and reroutes the browser to `/login`.

---

### CO4: Express HTTP Service, Callbacks, Events, and Listeners [Marks: 2]
> **Question:** Design an Express HTTP service to receive network events and use Node.js to process them. Explain how callbacks, events, and listeners can be used to detect repeated failed connection attempts and trigger an alert.

#### 1. Architecture of `SecurityEventHub` (`eventService.js`):
Node.js's native `EventEmitter` class is subclassed to create an event-driven security monitoring bus:
```javascript
const { EventEmitter } = require('events');
class SecurityEventHub extends EventEmitter {
  constructor() {
    super();
    this.failedAttemptsMap = new Map(); // Sliding window IP tracker
    this.setupListeners();
  }
}
```

#### 2. Callbacks, Events & Listener Implementation:
1. **Emitting the Event:** Whenever a login attempt fails (e.g. wrong password or nonexistent user), Express triggers:
   ```javascript
   securityEventHub.emit('failedLogin', { ipAddress, email, userAgent });
   ```
2. **Listener & Callback Execution:** The listener updates the sliding window map:
   ```javascript
   this.on('failedLogin', (eventData) => {
     let tracker = this.failedAttemptsMap.get(ipAddress) || { attempts: 0 };
     tracker.attempts += 1;
     
     // Threshold evaluation
     if (tracker.attempts >= config.LOCKOUT_THRESHOLD) { // 3 attempts
       tracker.lockUntil = new Date(Date.now() + 60000); // 60s lockout
       this.emit('bruteForceAlert', { ipAddress, attempts: tracker.attempts });
     }
     this.failedAttemptsMap.set(ipAddress, tracker);
   });
   ```
3. **Alert Triggering (`bruteForceAlert`):**
   * Emitted when `attempts >= 3`.
   * Listener logs an alert document into the `NetworkAuditLog` collection.
   * Dispatches live SSE packet to connected React dashboard clients.
   * Future HTTP connection requests from this IP receive HTTP `429 Too Many Requests` until the lockout elapses.

---

### CO5: MongoDB, Mongoose and Database Operations [Marks: 2]
> **Question:** Design a MongoDB collection to store application records and related status information. Write suitable Node.js/Mongoose operations to insert, retrieve, update, and delete records as required by the proposed application.

#### 1. Mongoose Schema (`models/Session.js`):
```javascript
const SessionSchema = new mongoose.Schema({
  sessionId: { type: String, required: true, unique: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  username: { type: String, required: true },
  token: { type: String, required: true },
  ipAddress: { type: String, default: '127.0.0.1' },
  userAgent: { type: String, default: 'Unknown' },
  state: { type: String, enum: ['ACTIVE', 'EXPIRED', 'REVOKED'], default: 'ACTIVE' },
  expiresAt: { type: Date, required: true }
}, { timestamps: true });
```

#### 2. Mongoose CRUD Operations Implementation:
* **INSERT (Create Session on Login):**
  ```javascript
  const session = await Session.create({
    sessionId, userId: user._id, username: user.username,
    token, ipAddress, userAgent, state: 'ACTIVE', expiresAt
  });
  ```
* **RETRIEVE (Get All Sessions for Current User):**
  ```javascript
  const sessions = await Session.find({ userId: req.user._id }).sort({ createdAt: -1 });
  ```
* **UPDATE (Renew Session Expiration Time):**
  ```javascript
  const updated = await Session.findOneAndUpdate(
    { sessionId: req.session.sessionId },
    { expiresAt: newExpiresAt, state: 'ACTIVE' },
    { new: true }
  );
  ```
* **DELETE / REVOKE (Revoke Single Session or Bulk Revoke Others):**
  ```javascript
  // Single revoke:
  await Session.findOneAndUpdate({ sessionId, userId }, { state: 'REVOKED' });
  
  // Bulk revoke others:
  await Session.updateMany(
    { userId, sessionId: { $ne: currentSessionId }, state: 'ACTIVE' },
    { state: 'REVOKED' }
  );
  ```

---

## PART 2: FINITE AUTOMATA & FORMAL LANGUAGES (CO1 – CO5)

### TOC CO1: Finite Automata and State Transitions [Marks: 2]
> **Question:** Model the main workflow of your proposed project using a finite automaton. Draw the state-transition diagram and identify the initial and final states.

#### Formal 5-Tuple Definition:
$$M = (Q, \Sigma, \delta, q_0, F)$$
* **$Q$ (Set of States):**
  $$\{ \text{LOGGED\_OUT}, \text{AUTHENTICATING}, \text{LOGGED\_IN}, \text{SESSION\_EXPIRED}, \text{LOCKED\_OUT} \}$$
* **$\Sigma$ (Input Alphabet):**
  $$\{ \text{SUBMIT}, \text{AUTH\_SUCCESS}, \text{AUTH\_FAIL\_LOW}, \text{AUTH\_FAIL\_BURST}, \text{TIMEOUT}, \text{RENEW}, \text{LOGOUT}, \text{RESET} \}$$
* **$q_0$ (Initial State):** $\text{LOGGED\_OUT}$
* **$F$ (Set of Final / Accepting States):**
  $$\{ \text{LOGGED\_IN}, \text{LOGGED\_OUT} \}$$
  *(LOGGED\_IN is accepting because protected user operations are granted; LOGGED\_OUT is accepting because user session is cleanly terminated).*

#### Transition Table $\delta(q, \sigma)$:
| Current State ($q$) | Input Symbol ($\sigma$) | Next State $\delta(q, \sigma)$ | Condition / Action |
|---|---|---|---|
| `LOGGED_OUT` ($q_0$) | `SUBMIT` | `AUTHENTICATING` | User posts credentials |
| `AUTHENTICATING` | `AUTH_SUCCESS` | `LOGGED_IN` ($F$) | Bcrypt hash matches; JWT issued |
| `AUTHENTICATING` | `AUTH_FAIL_LOW` | `AUTHENTICATING` | Password mismatch; attempt $< 3$ |
| `AUTHENTICATING` | `AUTH_FAIL_BURST`| `LOCKED_OUT` | Attempt $\ge 3$; event listener triggers lockout |
| `LOGGED_IN` ($F$) | `TIMEOUT` | `SESSION_EXPIRED` | Session countdown reaches 0s |
| `LOGGED_IN` ($F$) | `RENEW` | `LOGGED_IN` ($F$) | Expiration time extended (+300s) |
| `LOGGED_IN` ($F$) | `LOGOUT` | `LOGGED_OUT` ($F$) | Session marked `REVOKED` |
| `SESSION_EXPIRED` | `SUBMIT` | `AUTHENTICATING` | User re-enters credentials |
| `SESSION_EXPIRED` | `LOGOUT` | `LOGGED_OUT` ($F$) | User dismisses expired prompt |
| `LOCKED_OUT` | `RESET` | `LOGGED_OUT` ($F$) | 60s cooldown elapses or admin resets |

---

### TOC CO2: Regular Expressions and Regular Languages [Marks: 2]
> **Question:** Write a suitable regular expression to validate an input or detect a pattern relevant to your project. Explain how the expression identifies valid and invalid inputs.

#### 1. Password Complexity Regular Expression:
```regex
^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#^])[A-Za-z\d@$!%*?&#^]{8,}$
```

#### 2. Identification of Valid & Invalid Inputs:
* **Valid Inputs:** `SecurePass@2026`, `Admin#994!`, `University$1A`
* **Invalid Inputs:**
  * `pass1234` $\to$ Rejected (missing uppercase letter and special symbol).
  * `WELCOME123` $\to$ Rejected (missing lowercase letter and special symbol).
  * `Ab1@` $\to$ Rejected (length $< 8$ characters).

#### 3. Formal Language Explanation:
By Kleene's Theorem, this regular expression represents the intersection of 5 regular languages:
$$L = L_{min8} \cap L_{upper} \cap L_{lower} \cap L_{digit} \cap L_{symbol}$$
* `(?=.*[a-z])`: Lookahead asserting at least one lowercase letter from alphabet $\Sigma_{lower}$.
* `(?=.*[A-Z])`: Lookahead asserting at least one uppercase letter from alphabet $\Sigma_{upper}$.
* `(?=.*\d)`: Lookahead asserting at least one digit from $\Sigma_{digit} = \{0..9\}$.
* `(?=.*[@$!%*?&#^])`: Lookahead asserting at least one special symbol.
* `{8,}`: Guarantees length constraint $|w| \ge 8$.
Since every component recognizes a regular language and regular languages are closed under intersection and concatenation, the pattern defines a regular language recognized by a Deterministic Finite Automaton (DFA).

---

### TOC CO3: Context-Free Grammars [Marks: 2]
> **Question:** Define a context-free grammar for a structured input or sequence used in your project. Show a sample derivation using the grammar.

#### 1. Grammar Definition for Bearer Authorization Header:
$$G = (V, \Sigma, R, S)$$
* **$V$ (Variables):** $\{ S, \text{TOKEN}, \text{HEADER}, \text{PAYLOAD}, \text{SIG}, \text{CLAIMS}, \text{PAIR}, \text{KEY}, \text{VAL} \}$
* **$\Sigma$ (Terminals):** $\{ \text{"Bearer "}, \text{"."}, \text{"\{"}, \text{"\}"}, \text{":"}, \text{","}, \text{"sub"}, \text{"role"}, \text{"user123"}, \text{"admin"}, \text{sig\_hash} \}$
* **$S$:** Start Symbol

#### 2. Production Rules ($R$):
1. $S \to \text{Bearer } \text{TOKEN}$
2. $\text{TOKEN} \to \text{HEADER} . \text{PAYLOAD} . \text{SIG}$
3. $\text{HEADER} \to \text{eyJhbGciOiJIUzI1NiJ9}$
4. $\text{PAYLOAD} \to \{ \text{CLAIMS} \}$
5. $\text{CLAIMS} \to \text{PAIR} \mid \text{PAIR} , \text{CLAIMS}$
6. $\text{PAIR} \to \text{KEY} : \text{VAL}$
7. $\text{KEY} \to \text{"sub"} \mid \text{"role"}$
8. $\text{VAL} \to \text{"user123"} \mid \text{"admin"}$
9. $\text{SIG} \to \text{hmac\_sha256\_hash}$

#### 3. Sample Leftmost Derivation ($S \Rightarrow^* w$):
$$S \Rightarrow \text{Bearer TOKEN}$$
$$\Rightarrow \text{Bearer HEADER . PAYLOAD . SIG}$$
$$\Rightarrow \text{Bearer eyJhbGciOiJIUzI1NiJ9 . PAYLOAD . SIG}$$
$$\Rightarrow \text{Bearer eyJhbGciOiJIUzI1NiJ9 . } \{ \text{CLAIMS} \} \text{ . SIG}$$
$$\Rightarrow \text{Bearer eyJhbGciOiJIUzI1NiJ9 . } \{ \text{PAIR} \} \text{ . SIG}$$
$$\Rightarrow \text{Bearer eyJhbGciOiJIUzI1NiJ9 . } \{ \text{KEY : VAL} \} \text{ . SIG}$$
$$\Rightarrow \text{Bearer eyJhbGciOiJIUzI1NiJ9 . } \{ \text{"role":"admin"} \} \text{ . hmac\_sha256\_hash}$$

---

### TOC CO4: Pushdown Automata [Marks: 2]
> **Question:** Explain how a pushdown automaton and its stack can be used to recognize a suitable structured pattern related to your project. Identify the states and stack operations.

#### 1. PDA Definition for Balanced Claim Brackets:
$$M = (Q, \Sigma, \Gamma, \delta, q_0, Z_0, F)$$
* **$Q$:** $\{ q_0, q_1, q_{accept}, q_{reject} \}$
* **$\Sigma$:** $\{ \{, \}, [, ], \text{alphanumeric}, :, , \}$
* **$\Gamma$:** $\{ \{, [, Z_0 \}$ (Stack symbols, with $Z_0$ as bottom marker)
* **$q_0$:** Initial state
* **$Z_0$:** Initial stack symbol
* **$F$:** $\{ q_{accept} \}$

#### 2. Stack Operations:
1. **Push Operation:** When scanning an opening brace `'{'`, push it onto stack:
   $$\delta(q_1, \text{'\{'}, X) = (q_1, \text{'\{'}X)$$
2. **Pop Operation:** When scanning a closing brace `'}'` and stack top is `'{'`, pop the matching symbol:
   $$\delta(q_1, \text{'\}'}, \text{'\{'}) = (q_1, \epsilon)$$
3. **Acceptance:** When input string reaches EOF and stack contains only $Z_0$:
   $$\delta(q_1, \epsilon, Z_0) = (q_{accept}, Z_0)$$

#### 3. Execution Stack Trace for $w = \text{"\{role:\{perm:admin\}\}"}$:
| Step | Read Char | Current State | Stack Top $\to$ Bottom | Operation Executed |
|---|---|---|---|---|
| 0 | Start | $q_0$ | $[Z_0]$ | Initialize PDA |
| 1 | `'{'` | $q_1$ | $[\text{'\{'}, Z_0]$ | PUSH `'{'` |
| 2 | `role:` | $q_1$ | $[\text{'\{'}, Z_0]$ | NOOP (Advance scan pointer) |
| 3 | `'{'` | $q_1$ | $[\text{'\{'}, \text{'\{'}, Z_0]$ | PUSH `'{'` |
| 4 | `perm:admin` | $q_1$ | $[\text{'\{'}, \text{'\{'}, Z_0]$ | NOOP (Advance scan pointer) |
| 5 | `'}'` | $q_1$ | $[\text{'\{'}, Z_0]$ | POP matching `'{'` |
| 6 | `'}'` | $q_1$ | $[Z_0]$ | POP matching `'{'` |
| 7 | $\epsilon$ (EOF) | $q_{accept}$ | $[Z_0]$ | **ACCEPTED by PDA** |

---

### TOC CO5: Turing Machines and Computability [Marks: 2]
> **Question:** Explain the role of a Turing machine as a computational model and discuss whether the main validation or pattern-recognition task in your project is decidable.

#### 1. Turing Machine as a Computational Model:
A Deterministic 1-Tape Turing Machine $M = (Q, \Sigma, \Gamma, \delta, q_0, q_{accept}, q_{reject})$ models all Church-Turing computable algorithms using an infinite read-write tape and a discrete state transition function $\delta$.

#### 2. Decidability Analysis:
* **Target Problem:** Deciding whether an input credential string $w = \langle u \rangle \# \langle p \rangle$ belongs to language $L_{AUTH}$:
  $$L_{AUTH} = \{ u \# p \mid u \in L_{EMAIL} \land \text{bcrypt\_verify}(p, \text{hash}) = \text{true} \}$$
* **Mathematical Proof of Decidability:**
  1. **Finite Alphabet and Bounded Input Length:** The input $w \in \Sigma^*$ is strictly bounded by max input length ($N \le 256$ characters).
  2. **Linear-Time Syntax Verification:** The regex verification requires a Deterministic Finite Automaton scanning the tape left-to-right in exactly $O(n)$ tape head steps without head backtracking.
  3. **Cryptographic Verification Termination:** The bcrypt verification executes a key-derivation function with fixed cost parameter $2^{10} = 1024$ rounds. This algorithm is strictly acyclic and guaranteed to terminate in finite steps.
  4. **Halting Guarantee:** For every input string $w \in \Sigma^*$, the Turing machine transitions into either $q_{accept}$ (valid credentials) or $q_{reject}$ (invalid credentials or syntax error). It never loops infinitely.
* **Conclusion:** Because the Turing Machine halts on all inputs in finite time (computable in polynomial time $P$), the authentication and session validation problem is **STRICTLY DECIDABLE** (Recursive Language).

---

## PART 3: COMPUTER NETWORKS IMPLEMENTATION DETAILS

1. **HTTP/1.1 REST Protocol & Methods:**
   * `POST /api/auth/login`: Submits JSON body, receives JWT session.
   * `GET /api/sessions/all`: Queries all active session records.
   * `DELETE /api/sessions/revoke/:id`: Terminates single session record.
   * `POST /api/network/simulate-attack`: Dispatches rapid burst traffic to verify listener security.
2. **HTTP Status Code Mapping:**
   * `200 OK`: Request succeeded (login verified, profile fetched).
   * `201 Created`: New user registered.
   * `400 Bad Request`: Input validation failed (regex pattern mismatch).
   * `401 Unauthorized`: Token missing, expired, or invalid password.
   * `429 Too Many Requests`: Client IP locked out after 3 failed connections.
3. **Network Header Inspection:**
   * Request Header: `Authorization: Bearer <jwt_token>` transmitting credentials securely.
   * Network Proxy Header: `X-Forwarded-For` extracted to accurately identify client IP behind reverse proxies.
4. **TCP Socket State Simulator:**
   * Visualizes the TCP connection lifecycle: `LISTEN` $\to$ `SYN_SENT` $\to$ `ESTABLISHED` $\to$ `CLOSE_WAIT`.
5. **Server-Sent Events (SSE) Stream:**
   * Persistent connection over HTTP with `Content-Type: text/event-stream` delivering real-time security alerts from Node.js event listeners directly into the React dashboard without polling.

---

## PART 4: PRODUCTION DEPLOYMENT GUIDE

### 1. Vercel (Frontend Deployment):
1. Import the GitHub repository into **Vercel**.
2. Select Root Directory: `frontend`.
3. Framework Preset: **Vite**.
4. Set Environment Variable in Vercel:
   `VITE_API_URL = https://your-backend-service.onrender.com/api`
5. Click **Deploy**. Vercel will build the React SPA using the provided `vercel.json` rewrite configuration.

### 2. Render (Backend Deployment):
1. Sign in to **Render.com** and click **New + > Web Service**.
2. Select your GitHub repository.
3. Configuration:
   * Root Directory: `backend`
   * Build Command: `npm install`
   * Start Command: `npm start`
4. Set Environment Variables:
   * `PORT = 5000`
   * `JWT_SECRET = <secure_random_string>`
   * `SESSION_EXPIRY_SECONDS = 300`
   * `LOCKOUT_THRESHOLD = 3`
   * `LOCKOUT_DURATION_SECONDS = 60`
   * `MONGODB_URI = mongodb+srv://<user>:<password>@cluster0.mongodb.net/auth_state_db?retryWrites=true&w=majority`
   * `FRONTEND_URL = https://your-frontend.vercel.app`
5. Click **Create Web Service**. Render provisions your Node.js/Express server with automatic HTTPS.
