import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, doc, onSnapshot, collection } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// 1. Firebase Config (Paste your actual config here)
const firebaseConfig = {
    apiKey: "AIzaSyCRpILPQ5n3PimcVlQTl2g1oJ5zwR2Xing",
    authDomain: "my-live-polling.firebaseapp.com",
    projectId: "my-live-polling",
    storageBucket: "my-live-polling.firebasestorage.app",
    messagingSenderId: "367126138943",
    appId: "1:367126138943:web:857243dd5c68a2f00ce88a"
};

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

// A classy, muted color palette
const colors = ["#4C72B0", "#55A868", "#C44E52", "#8172B2", "#CCB974", "#64B5CD"];
// 3. Wait for the DOM to load before grabbing elements
document.addEventListener("DOMContentLoaded", () => {
    const loginBtn = document.getElementById('pollLoginBtn');
    const overlay = document.getElementById('live-poll-overlay');

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

                // If question changed, reset swarm
                if (data.active_question_id && data.options.join() !== currentOptions.join()) {
                    initSwarm(data.options);
                    listenToAnswers(data.active_question_id);
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

        const xScale = d3.scalePoint().domain(options).range([100, width - 100]);
        
        // Use custom colors array
        const colorScale = d3.scaleOrdinal()
            .domain(options)
            .range(colors);

        // Draw classy text labels at the bottom
        svg.selectAll(".label")
            .data(options).enter().append("text")
            .attr("class", "label")
            .attr("x", d => xScale(d))
            .attr("y", height - 20) 
            .attr("text-anchor", "middle")
            .text(d => `${d} (0)`);

        simulation = d3.forceSimulation(nodes)
            .force("x", d3.forceX(d => xScale(d.choice)).strength(0.15))
            .force("y", d3.forceY(height / 2 - 30).strength(0.1))
            .force("collide", d3.forceCollide(currentRadius + 1).strength(1).iterations(3))
            .velocityDecay(0.15)
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

            d3.select("#resultsChart").selectAll(".label").text(d => `${d} (${tallies.get(d)})`);

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
                        y: -20, vy: 10 
                    });
                }
            });

            currentRadius = Math.max(4, Math.min(20, 350 / Math.sqrt(Math.max(1, nodes.length))));

            if (simulation) {
                simulation.force("collide", d3.forceCollide(currentRadius + 1).strength(1).iterations(3));
                simulation.nodes(nodes);
                simulation.alpha(0.8).restart();
            }
        });
    }
});
