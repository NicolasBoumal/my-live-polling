import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, doc, onSnapshot, collection } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

import { firebaseConfig, clickerUrl } from "./config.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// 2. State & D3 Variables
let unsubscribeLiveState = null;
let unsubscribeAnswers = null;
let simulation;
let nodes = [];
let currentOptions = [];
let currentRadius = 12;
let currentQuestionId = null;

// Custom color palette
const colors = ["#4C72B0", "#55A868", "#C44E52", "#8172B2", "#64B5CD", "#CCB974"];

// 3. Wait for the DOM to load before grabbing elements
document.addEventListener("DOMContentLoaded", () => {
    const loginBtn = document.getElementById('pollLoginBtn');
    const overlay = document.getElementById('live-poll-overlay');
    const qrContainer = document.getElementById('qr-container');
    const qrImage = document.getElementById('qr-image');
    const qrUrl = document.getElementById('qr-url');

    // Authentication Logic
    if (loginBtn) {
        loginBtn.addEventListener('click', () => {
            signInWithPopup(auth, new GoogleAuthProvider()).catch(err => console.error(err));
        });
    }

    onAuthStateChanged(auth, (user) => {
        if (user) {
            if (loginBtn) loginBtn.classList.add('hidden'); // Hide button once logged in
            startListening();
        } else {
            if (loginBtn) loginBtn.classList.remove('hidden');
        }
    });

    // 4. Firebase Listeners
    function startListening() {
        unsubscribeLiveState = onSnapshot(doc(db, "state", "live"), (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                
                // Toggle visibility based on the 'reveal' boolean
                if (data.reveal && data.active_question_id) {
                    overlay.style.visibility = "visible";
                } else {
                    overlay.style.visibility = "hidden";
                }

                // If the question ID changed, reset the swarm
                if (data.active_question_id && data.active_question_id !== currentQuestionId) {
                    currentQuestionId = data.active_question_id; // Store the new ID
                    initSwarm(data.options);
                    listenToAnswers(data.active_question_id);
                }

                // Show/hide the QR code
                if (data.showQR) {
                    // Generate the QR code URL using the API
                    qrImage.src = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(clickerUrl)}`;
                    qrUrl.innerHTML = clickerUrl;
                    qrContainer.classList.remove('hidden');
                } else {
                    qrContainer.classList.add('hidden');
                }
            }
        });
    }

    // 5. D3 Physics & Drawing Logic
    function initSwarm(options) {
        if (simulation) simulation.stop();
        currentOptions = options;
        nodes = [];

        const svg = d3.select("#resultsChart");
        svg.selectAll("*").remove(); // Wipe clean
        
        // Use clientWidth/Height of the container to scale dynamically
        const container = document.getElementById("resultsChart");
        const width = container.clientWidth || 900;
        const height = container.clientHeight || 400;

        // Adjust side margins based on the number of options
        // If 2 options: margin is 30% of width (keeps them closer to center)
        // If 4+ options: margin is 10% of width (spreads them out more)
        const marginFactor = options.length <= 2 ? 0.30 : (options.length === 3 ? 0.20 : 0.10);
        const margin = width * marginFactor;

        const xScale = d3.scalePoint()
            .domain(options)
            .range([margin, width - margin]);

        const colorScale = d3.scaleOrdinal()
            .domain(options)
            .range(colors);

        // Draw classy text labels at the bottom
        svg.selectAll(".label")
            .data(options).enter().append("text")
            .attr("class", "label")
            .attr("x", d => xScale(d))
            .attr("y", 0.75*height)
            .attr("text-anchor", "middle")
            .text(d => `${d} (0)`);

        simulation = d3.forceSimulation(nodes)
            .force("x", d3.forceX(d => xScale(d.choice)).strength(0.10))
            .force("y", d3.forceY(height / 2 - 30).strength(0.05))
            .force("collide", d3.forceCollide(currentRadius + 1).strength(1).iterations(3))
            .velocityDecay(0.35)
            .on("tick", ticked);

        function ticked() {
            const circles = svg.selectAll("circle").data(nodes, d => d.id);
            circles.enter()
                .append("circle")
                .merge(circles)
                .attr("r", currentRadius)
                .attr("cx", d => d.x)
                .attr("cy", d => d.y)
                .attr("fill", d => colorScale(d.choice));
            circles.exit().remove();
        }
    }

    function listenToAnswers(questionId) {
        if (unsubscribeAnswers) unsubscribeAnswers();

        unsubscribeAnswers = onSnapshot(collection(db, "questions", questionId, "answers"), (snapshot) => {
            const newVotesMap = new Map();
            const tallies = new Map(currentOptions.map(opt => [opt, 0]));

            snapshot.forEach(doc => {
                const choice = doc.data().choice;
                newVotesMap.set(doc.id, choice);
                if (tallies.has(choice)) tallies.set(choice, tallies.get(choice) + 1);
            });

            d3.select("#resultsChart").selectAll(".label").text(d => `${d} (${tallies.get(d)})`).raise(); // raise() makes the text appear on top of circles

            nodes = nodes.filter(n => newVotesMap.has(n.id));

            const width = document.getElementById("resultsChart").clientWidth || 900;

            newVotesMap.forEach((choice, id) => {
                const existingNode = nodes.find(n => n.id === id);
                if (existingNode) {
                    existingNode.choice = choice;
                } else {
                    nodes.push({ 
                        id: id, choice: choice, 
                        x: width / 2 + (Math.random() - 0.5) * 50, 
                        y: -5, vy: 3 
                    });
                }
            });

            currentRadius = Math.max(4, Math.min(25, 350 / Math.sqrt(Math.max(1, nodes.length))));

            if (simulation) {
                simulation.force("collide", d3.forceCollide(currentRadius + 1).strength(1).iterations(3));
                simulation.nodes(nodes);
                simulation.alpha(0.8).restart();
            }
        });
    }
});
