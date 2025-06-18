function startGameLogic() {
// JUST IN CASE check if cookies have been accepted (even tho i use local storage :P)
if (localStorage.getItem('userConsent') !== 'accepted') {
  console.warn("Consent not given. Aborting game/script logic.");
  throw new Error("Script stopped due to lack of user consent.");
}
}
startGameLogic();

let upgradeModifiers = 0; 
let fishOnRod = null;     
let fishBiteTimeout = null; 
let fishEscapeTimeout = null; 
let attemptsLeft = 3;
let fishingInProgress = false; 
let biome = document.getElementById("biomeSelect").value;

// inventory
let inventory = [];
let money = parseFloat(localStorage.getItem("playerMoney")) || 0;

//item upgrades
let rodLevel = parseInt(localStorage.getItem("rodLevel")) || 1;
let baitLevel = parseInt(localStorage.getItem("baitLevel")) || 1;
let unlockedBiomes = JSON.parse(localStorage.getItem("unlockedBiomes")) || ["pond"];

//load local or set base values.
updateBiomeSelect();
saveProgress();


// where we for now display text
// TODO make a canvas type of thing so we can have visuals!
let textDisplay = document.getElementById("fishTextDisplay");

// get localstorage inventory.
const savedInventory = localStorage.getItem('fishingGameInventory');
if (savedInventory) {
  inventory = JSON.parse(savedInventory);
  console.log("Loaded inventory from local storage for fishing game");
}

// api connection to my FISH DATA BASE (was tempted to call it "fishyBusiness.php")
let fishList = [];
    fetch('/api/getFish.php')
    .then(response => response.json())
    .then(data => {
    fishList = [];
    // gets fish per biome and puts them in array of that biome. 
    for (const biome in data) {
    const fishInBiome = data[biome];

        for (const fishKey in fishInBiome) {
            const fish = fishInBiome[fishKey];
            fish.biome = biome; // Tag fish with biome name
            fish.difficulty = parseFloat(fish.difficulty); // convert to number
            fishList.push(fish);
        }
    }

    console.log("Fish list loaded!");
})
//error logging incase something is up with API
.catch(err => console.error("Error loading fish data:", err));

// create the canvas for cool stuff later.
const canvas = document.getElementById("fish-container");
// TODO const ctx = canvas.getContext("2d"); 
// ^ this is for visual adding this in v1.5 or v2

/**
 * 
 *  save function
 *
 * as stated above saves all progress to local storage. 
 */
function saveProgress() {
    localStorage.setItem("playerMoney", money);
    localStorage.setItem("rodLevel", rodLevel);
    localStorage.setItem("baitLevel", baitLevel);
    localStorage.setItem("unlockedBiomes", JSON.stringify(unlockedBiomes));
}

/**
 * 
 * Cast rod 
 * 
 * -footnote, if you dont know what this is for, casting the fishing rod. 
 * so starting the game.
 */ 
function castRod() {
if (fishingInProgress) {
    textDisplay.innerHTML ="You already have a line cast!";
    return;
}
// sets standard things per fish here, so we can call them back later. 
fishingInProgress = true; // makes sure we can only cast one line.
attemptsLeft = 3; //? maybe make an item so you get more?
fishOnRod = null; // temp variable for the fish.
biome = document.getElementById("biomeSelect").value; // gets selected value from HTML

// Random bite time between 5 and 60 seconds can be reduced by bate
let baseBiteTime = 5000 + Math.random() * 55000;

// reduces bite time by bait level
const biteReduction = baitLevel * 500;

// makes Bitetime so we can use upgrades to reduce the time.
const biteTime = Math.max(baseBiteTime - biteReduction, 1000);

// for now we use this instead of an display so maybe remove it.
textDisplay.innerHTML = `Casting rod... wait for a fish to bite.`;

// sets time out timer for the fish. and gets a fish for the biome.
fishBiteTimeout = setTimeout(() => {
    fishOnRod = getFishForBiome(biome);
    if (!fishOnRod) {
        textDisplay.innerHTML = "No fish available for this biome!";
        fishingInProgress = false;
    return;
    }
    textDisplay.innerHTML = `A fish bit! It's a ${fishOnRod.name} with difficulty ${fishOnRod.difficulty}. Reel it in!`;
    startFishEscapeTimer()
}, biteTime);
}

// Gets a random fish from current biome
function getFishForBiome(biome) {
// Filter fishList by biome, return a random one from the biome's fish
const fishInBiome = fishList.filter(f => f.biome === biome);
if (fishInBiome.length === 0) return null;
return fishInBiome[Math.floor(Math.random() * fishInBiome.length)];
}

// Escape timer so we need a player to be active.
function startFishEscapeTimer() {
    // Random timeout between 10 and 30 seconds (10000 to 30000 ms)
    const escapeTime = 10000 + Math.random() * 20000;

    fishEscapeTimeout = setTimeout(() => {
    if (fishingInProgress && fishOnRod) {
        textDisplay.innerHTML = `The fish escaped! You took too long.`;
        resetFishing();
    }
    }, escapeTime);
}

/**
 * 
 *  REEL IN
 * 
 */
function reelIn() {
// Cant reel in if player has not cast rod yet.
if (!fishingInProgress) {
    textDisplay.innerHTML = "You need to cast your rod first!";
    return;
}
  // Update gui so that players know that code is running.
  if (!fishOnRod) {
    // Incase rod is cast tell player this if there is no fish biting 
    textDisplay.innerHTML = "No fish is biting yet!";
    // calls time out function. 
    setTimeout(() => {
      // after about 0.02 seconds. we set this text down, update is here so we don't see just the previous line. 
        textDisplay.innerHTML ="🎣 Casting rod... wait for a fish to bite.";
    }, 2000);
    return;
  }
    // Randomcast is a const we check aiganst the adjusted difficulty of the fish, so players need upgrades to play in harder areas.
    const randomCast = upgradeModifiers + Math.floor(Math.random() * 10);
    const adjustedDifficulty = fishOnRod.difficulty / rodLevel;

    // if the difficulty is lower then the randomcast catch the fish. 
    if (randomCast >= adjustedDifficulty) {
        const weight = parseFloat(fishOnRod.weight);
        const rarity = parseFloat(fishOnRod.rarity);
        const value = (Math.random() * 1) * weight * rarity;

        // set a value to the fish and the caught fish.
        const caughtFish = {
          ...fishOnRod,
          value: parseFloat(value.toFixed(2)) 
        };

        //adds fish to inventory. and safe it.
        inventory.push(caughtFish);
        saveInventoryToLocal();

        // Announce the fish and value of the fish to player.
        textDisplay.innerHTML = `You caught a ${caughtFish.name} worth $${caughtFish.value}!`;

        // resets the fishing rod so we can cast it again.
        resetFishing();
    } else {
      // the 3 attempt system if the randomcast isn't high enough.
        attemptsLeft--;
        if (attemptsLeft > 0) {
            textDisplay.innerHTML =`Failed to reel in. Attempts left: ${attemptsLeft}. Try again!`;
        } else {
            textDisplay.innerHTML =`The line broke! You lost the fish.`;
            resetFishing();
        }
    }
}

/**
 * 
 *  Reset fishing
 * 
 * ! resets the rod not the entire game.
 */ 
function resetFishing() {
    if (fishEscapeTimeout) {
    clearTimeout(fishEscapeTimeout);
    fishEscapeTimeout = null;
    }
    fishingInProgress = false;
    fishOnRod = null;
    attemptsLeft = 3;
    if (fishBiteTimeout) {
        clearTimeout(fishBiteTimeout);
        fishBiteTimeout = null;
    }
}

/**
 * 
 *  Inventory logic
 *  ? for now dynamic with just HTML might make this different in v1.1 or v1.5
 */
function showInventory() {
    const display = document.getElementById("fishInventoryDisplay");

  // Makes inventory display toggleable
    if (display.style.display === "block") {
    display.style.display = "none";  // Hide shop if already open
    return;
    }
    renderInventoryHTML();
    display.style.display = "block";
}
// loads inventory HTML 
// TODO make better. you know how
// ? might add CSS?
function renderInventoryHTML() {
  const display = document.getElementById("fishInventoryDisplay");

  if (inventory.length === 0) {
    display.innerHTML = `<h3> Money: $ ${money.toFixed(2)}</h3><p>Inventory is empty.</p>`;
    return;
  }

  let html = `<h3>Money: $ ${money.toFixed(2)}</h3>
                <h3>Inventory</h3>
              <form id="sellFishForm">
                <ol>`;
  inventory.forEach((fish, index) => {
    html += `<li>
                <label>
                  <input type="checkbox" name="sellFish" value="${index}">
                  ${fish.name} - $${fish.value} | Weight: ${fish.weight} | Rarity: ${fish.rarity}
                </label>
              </li>`;
  });
  html += `</ol>
            <button type="submit">Sell Selected Fish</button>
            </form>`;

  display.innerHTML = html;

  document.getElementById("sellFishForm").addEventListener("submit", handleSellSelectedFish);
}

// sell the selected fish.
function handleSellSelectedFish(e) {
  e.preventDefault();
  const selectedIndexes = Array.from(document.querySelectorAll('input[name="sellFish"]:checked'))
                                .map(input => parseInt(input.value));
  // can not sell if no fish is selected
  if (selectedIndexes.length === 0) {
    alert("No fish selected!");
    return;
  }
  // set total earned to 0, so we can add to it, but its always start at 0.
  let totalEarned = 0;

  // Sort in reverse so we can safely remove the selected fish by index.
  selectedIndexes.sort((a, b) => b - a);

  // removes sold fish from the inventory.
  selectedIndexes.forEach(index => {
    totalEarned += inventory[index].value;
    inventory.splice(index, 1);
  });
money += totalEarned;
// updates money, inventory and saves progress.
updateMoneyDisplay();
  saveInventoryToLocal();
  saveProgress();
  renderInventoryHTML();
  alert(`You sold ${selectedIndexes.length} fish for $${totalEarned.toFixed(2)}!`);
}

// Updates money display.
function updateMoneyDisplay() {
  localStorage.setItem("playerMoney", money);
}

// saves inventory to local data.
function saveInventoryToLocal() {
  localStorage.setItem('fishingGameInventory', JSON.stringify(inventory));
}

/**
 * 
 *  Shop
 *  
 *  Renders shop UI
 */
function renderShopUI() {
    const display = document.getElementById("fishShopDisplay");
    
    // makes shop toggelable.
    if (display.style.display === "block") {
    display.style.display = "none";  // Hide shop if already open
    return;
    }
    display.style.display = "block";
  
  // dynamically makes the price of upgrades hire.
  const rodCost = Math.floor(5 * Math.pow(1.5, rodLevel - 1));
  const baitCost = Math.floor(3 * Math.pow(1.8, baitLevel - 1));

  // biome options. 
  //? might make more in another Version, for now this is enough.
  let biomeOptions = ["ocean", "river", "lake", "swamp", "ice"];
  let shopHTML = `<h3>Fishing Shop</h3><h4>Money: $${money.toFixed(2)}</h4>
    <ol>
      <li>Rod Level: ${rodLevel} - Upgrade for $${rodCost}
        <button onclick="buyRodUpgrade(${rodCost})">Upgrade Rod</button></li>
      <li>Bait Level: ${baitLevel} - Upgrade for $${baitCost}
        <button onclick="buyBaitUpgrade(${baitCost})">Upgrade Bait</button></li>
    </ol>
    <h4>Unlock New Biomes</h4><ol>`;

  // makes it so we can buy biomes, and the prices go up dynamically.
  biomeOptions.forEach((biome, index) => {
    if (!unlockedBiomes.includes(biome)) {
      const cost = Math.floor(100 * Math.pow(2.5, unlockedBiomes.length - 1));
      shopHTML += `<li>${biome} - $${cost}
        <button onclick="buyBiome('${biome}', ${cost})">Unlock</button></li>`;
    }
  });

  shopHTML += `</ol>`;

  display.innerHTML = shopHTML;
}
// updates shopUI money and saves progress after upgrade purchase.
function buyRodUpgrade(cost) {
  if (money >= cost) {
    money -= cost;
    rodLevel++;
    updateMoneyDisplay();
    saveProgress();
    renderShopUI();
  } else {
    // not enough money so cant buy the upgrade.
    alert("Not enough money!");
  }
}
// basically same as previous function but for bait. 
function buyBaitUpgrade(cost) {
  if (money >= cost) {
    money -= cost;
    baitLevel++;
    updateMoneyDisplay();
    saveProgress();
    renderShopUI();
  } else {
    alert("Not enough money!");
  }
}
// buying biome logic.
function buyBiome(biome, cost) {
  if (money >= cost) {
    money -= cost;
    unlockedBiomes.push(biome);
    updateBiomeSelect();
    updateMoneyDisplay();
    saveProgress();
    renderShopUI();
  } else {
    alert("Not enough money!");
  }
}

/**
 * 
 *  biome unlock
 * 
 */
//this makes it so we can selected the purchased biomes.
function updateBiomeSelect() {
  const biomeSelect = document.getElementById("biomeSelect");
  const allBiomes = [
    {value: "pond", label: "Pond"},
    {value: "ocean", label: "Ocean"},
    {value: "river", label: "River"},
    {value: "lake", label: "Lake"},
    {value: "swamp", label: "Swamp"},
    {value: "ice", label: "Ice Biome"}
  ];

  biomeSelect.innerHTML = ""; // Clear current options

  allBiomes.forEach(biome => {
    const option = document.createElement("option");
    option.value = biome.value;
    option.textContent = biome.label;

    // Enable only if unlocked, else disable
    if (!unlockedBiomes.includes(biome.value)) {
      option.disabled = true;
    }

    // Select pond by default or currently selected biome
    if (biome.value === "pond") {
      option.selected = true;
    }

    biomeSelect.appendChild(option);
  });
}

/**
 * 
 *  Developer items (use at one risk.)
 *  ? decided to keep it in so people can do funny stuff like cheat if they know how to ;D
 */
function getMoney() {
  return money;
}

function setMoney(amount) {
  money = amount;
  updateMoneyDisplay();
  saveProgress();
  renderInventoryHTML();
}

function resetGame() {
  console.log("reset the fishing game");

  money = 0;
  rodLevel = 1;
  baitLevel = 1;
  unlockedBiomes = ["pond"];
  inventory = [];

  saveProgress();
  saveInventoryToLocal();
  updateMoneyDisplay();
  updateBiomeSelect();
  renderInventoryHTML();
  renderShopUI();

  textDisplay.innerHTML = "Game reset! Start fresh.";
}

