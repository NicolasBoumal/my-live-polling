import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, doc, collection, onSnapshot } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// PASTE YOUR FIREBASE CONFIG HERE
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

const loginSection = document.getElementById('loginSection');
const dashboardSection = document.getElementById('dashboardSection');
const questionStatus = document.getElementById('questionStatus');
const voteCount = document.getElementById('voteCount');
const chartContainer = document.getElementById('chartContainer');

let unsubscribeAnswers = null;

// D3 Physics Variables
let simulation = null;
let nodes = []; // Holds the data for each student's vote
let currentOptions = [];
const width = 900;
const height = 500;
const radius = 13; // Size of the vote discs

// A classy, muted color palette
const colors = ["#4C72B0", "#55A868", "#C44E52", "#8172B2", "#CCB974", "#64B5CD"];

// 1. Authentication
document.getElementById('loginBtn').addEventListener('click', () => {
    signInWithPopup(auth, new GoogleAuthProvider()).catch(error => alert(error.message));
});

onAuthStateChanged(auth, (user) => {
    if (user) {
        loginSection.classList.add('hidden');
        dashboardSection.classList.remove('hidden');
        startListeningToLiveState();
    } else {
        loginSection.classList.remove('hidden');
        dashboardSection.classList.add('hidden');
    }
});

// 2. Setup D3 Canvas and Physics Simulation
function initSwarm(options) {

    if (simulation) {
        simulation.stop();
    }
    currentOptions = options;
    nodes = []; // Clear old dots

    const svg = d3.select("#resultsChart");
    svg.selectAll("*").remove(); // Clear previous drawing

    // Create a scale to evenly space the attractors (target locations) along the X axis
    const xScale = d3.scalePoint()
        .domain(options)
        .range([100, width - 100])
        .padding(0.5);

    // Create a color scale mapped to our options
    const colorScale = d3.scaleOrdinal()
        .domain(options)
        .range(colors);

    // Draw the text labels at the bottom
    svg.selectAll(".label")
        .data(options)
        .enter()
        .append("text")
        .attr("class", "label")
        .attr("x", d => xScale(d))
        .attr("y", height - 30)
        .attr("text-anchor", "middle")
        .text(d => `${d} (0)`);

    // Initialize the physics simulation
    simulation = d3.forceSimulation(nodes)
        // Pull dots toward their chosen category's X coordinate
        .force("x", d3.forceX(d => xScale(d.choice)).strength(0.12))
        // Pull dots toward the vertical center
        .force("y", d3.forceY((height / 2) - 20).strength(0.08))
        // Prevent dots from overlapping each other
        .force("collide", d3.forceCollide(radius + 1.5).iterations(3))
        .on("tick", ticked);

    // This function runs on every frame of the simulation to update circle positions
    function ticked() {
        const circles = svg.selectAll("circle").data(nodes, d => d.id);

        // Add new circles (only append the shape and static attributes like radius)
        circles.enter()
            .append("circle")
            .attr("r", radius)
            // Merge handles both new and updating circles
            .merge(circles)
            .attr("cx", d => d.x)
            .attr("cy", d => d.y)
            .attr("fill", d => colorScale(d.choice)); // Update color dynamically

        // Remove old circles
        circles.exit().remove();
    }
}

// 3. Listen to the Live State (Traffic Controller)
let lastKnownQuestionId = null; // Track the question ID (to be compared against the live question ID)

function startListeningToLiveState() {
    onSnapshot(doc(db, "state", "live"), (docSnap) => {
        if (docSnap.exists()) {
            const data = docSnap.data();
            
            // Update the visual status (Open/Closed)
            if (data.status === "open") {
                questionStatus.innerText = "Polling is Open";
                questionStatus.style.color = "#55A868";
            } else {
                questionStatus.innerText = "Polling is Closed";
                questionStatus.style.color = "#C44E52";
            }

            // Reveal logic
            chartContainer.style.visibility = data.reveal ? "visible" : "hidden";

            // Check if the Question ID has changed
            if (data.active_question_id !== lastKnownQuestionId) {
                console.log("New question detected. Resetting dashboard...");
                
                lastKnownQuestionId = data.active_question_id;
                currentOptions = data.options; // Update global options for the tally logic
                
                // 1. Clear the physical swarm and labels
                initSwarm(data.options);
                
                // 2. Kill the old answer listener and start the new one
                listenToAnswers(data.active_question_id);
            }
        }
    });
}

// 4. Listen to specific question's answers and feed the physics engine
function listenToAnswers(questionId) {
    if (unsubscribeAnswers) unsubscribeAnswers();

    const answersRef = collection(db, "questions", questionId, "answers");
    
    unsubscribeAnswers = onSnapshot(answersRef, (snapshot) => {
        voteCount.innerText = `Total Votes: ${snapshot.size}`;
        
        // Initialize a tally counter for our text labels
        const tallies = new Map();
        currentOptions.forEach(opt => tallies.set(opt, 0));
        
        // Map incoming data for quick lookup and count tallies
        const newVotesMap = new Map();
        snapshot.forEach(doc => {
            const choice = doc.data().choice;
            newVotesMap.set(doc.id, choice);
            
            // Increment the tally for this specific choice
            if (tallies.has(choice)) {
                tallies.set(choice, tallies.get(choice) + 1);
            }
        });

        // Update the text of all D3 labels dynamically
        d3.select("#resultsChart").selectAll(".label")
            .text(d => `${d} (${tallies.get(d)})`);

        // Remove nodes (students) who deleted their vote
        nodes = nodes.filter(n => newVotesMap.has(n.id));

        // Add or update nodes
        newVotesMap.forEach((choice, id) => {
            const existingNode = nodes.find(n => n.id === id);
            if (existingNode) {
                existingNode.choice = choice; // Change target attractor
            } else {
                // Spawn new vote dot at the top center of the screen
                nodes.push({ 
                        id: id, 
                        choice: choice, 
                        x: width / 2 + (Math.random() - 0.5) * 50, // Added jitter
                        y: -20, // Start above the SVG
                        vy: 10  // Initial downward velocity push
                    });
            }
        });

        // Feed the updated data array to the physics engine and 'kick' it to start moving
        if (simulation) {
            simulation.nodes(nodes);
            simulation.alpha(0.8).restart();
        }
    });
}
