console.log('lets write java script');
let currentSong = new Audio();
let songs; // Declared globally
let currFolder;

function secondsToMinutesSeconds(seconds) {
    if (isNaN(seconds) || seconds < 0) {
        return "00:00";
    }

    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);

    const formattedMinutes = String(minutes).padStart(2, '0');
    const formattedSeconds = String(remainingSeconds).padStart(2, '0');

    return `${formattedMinutes}:${formattedSeconds}`;
}

async function getSongs(folder) {
    currFolder = folder;
    let a = await fetch(`http://127.0.0.1:3000/${folder}/`)
    let response = await a.text()
    let div = document.createElement("div")
    div.innerHTML = response
    let as = div.getElementsByTagName("a")
    let songsArray = [] // Use a local variable to avoid confusion with the global 'songs'
    for (let index = 0; index < as.length; index++) {
        const element = as[index];
        if (element.href.endsWith(".mp3")) {
            songsArray.push(element.href.split(`/${folder}/`)[1])
        }
    }
    return songsArray
}

const playMusic = (track, pause = false) => {
    currentSong.src = `/${currFolder}/` + track
    if (!pause) {
        currentSong.play()
        play.src = "pause.svg" // Assuming 'play' is a global element
    }
    document.querySelector(".songinfo").innerHTML = decodeURI(track)
    document.querySelector(".songtime").innerHTML = "00:00 / 00:00"
}

// Function to display the list of songs in the sidebar
function displaySongsInPlaylist(songsToDisplay) {
    let songUL = document.querySelector(".songList").getElementsByTagName("ul")[0];
    songUL.innerHTML = ""; // Clear existing songs

    for (const song of songsToDisplay) {
        songUL.innerHTML += `<li><img class="invert" width="34" src="music.svg" alt="">
                                <div class="info">
                                    <div> ${song.replaceAll("%20", " ")}</div>
                                    <div>Harry</div>
                                </div>
                                <div class="playnow">
                                    <span>Play Now</span>
                                    <img class="invert" src="play.svg" alt="">
                                </div> </li>`;
    }

    // Attach an event listener to each song
    Array.from(songUL.getElementsByTagName("li")).forEach(e => {
        e.addEventListener("click", element => {
            // Trim and decode the song name before playing
            playMusic(e.querySelector(".info").firstElementChild.innerHTML.trim());
        });
    });
}


async function displayAlbums() {
    console.log("displaying albums")
    let a = await fetch(`http://127.0.0.1:3000/songs/`)
    let response = await a.text();
    let div = document.createElement("div")
    div.innerHTML = response;
    let anchors = div.getElementsByTagName("a")
    let cardContainer = document.querySelector(".cardContainer")
    cardContainer.innerHTML = "";

    const albumPromises = Array.from(anchors).map(async e => {
        if (e.href.includes("/songs/")) {
            let folder = e.href.split("/").slice(-2)[0];
            // Get the metadata of the folder
            try {
                let infoResponse = await fetch(`http://127.0.0.1:3000/songs/${folder}/info.json`);
                if (!infoResponse.ok) {
                    console.error(`Failed to fetch info.json for folder: ${folder}`);
                    return null;
                }
                let responseJson = await infoResponse.json();
                return `
                    <div data-folder="${folder}" class="card">
                        <div class="play">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none"
                                xmlns="http://www.w3.org/2000/svg">
                                <path d="M5 20V4L19 12L5 20Z" stroke="#141B34" fill="#000" stroke-width="1.5"
                                    stroke-linejoin="round" />
                            </svg>
                        </div>
                        <img src="/songs/${folder}/cover.jpg" alt="">
                        <h2>${responseJson.title}</h2>
                        <p>${responseJson.description}</p>
                    </div>`;
            } catch (error) {
                console.error(`Error fetching album info for ${folder}:`, error);
                return null;
            }
        }
        return null;
    });


    const albumHtmls = await Promise.all(albumPromises);

    cardContainer.innerHTML = albumHtmls.filter(html => html !== null).join('');

    // attaach event listeners
    document.querySelectorAll(".card").forEach(e => {
        e.addEventListener("click", async item => {
            console.log("Fetching Songs for folder:", item.currentTarget.dataset.folder);
            songs = await getSongs(`songs/${item.currentTarget.dataset.folder}`);
            playMusic(songs[0]);
            displaySongsInPlaylist(songs);
        });
    });
}


async function main() {
    // Get the initial list of songs
    songs = await getSongs("songs/ncs")
    playMusic(songs[0], true)
    displaySongsInPlaylist(songs);

    // Attach event listeners for playback controls
    play.addEventListener("click", () => {
        if (currentSong.paused) {
            currentSong.play()
            play.src = "pause.svg"
        } else {
            currentSong.pause()
            play.src = "play.svg"
        }
    })

    // Time update Event
    currentSong.addEventListener("timeupdate", () => {
        document.querySelector(".songtime").innerHTML = `${secondsToMinutesSeconds(currentSong.currentTime)}/${secondsToMinutesSeconds(currentSong.duration)}`
        document.querySelector(".circle").style.left = (currentSong.currentTime / currentSong.duration) * 100 + "%"
    })

    // add Event listener to seek bar
    document.querySelector(".seekbar").addEventListener("click", e => {
        let percent = (e.offsetX / e.target.getBoundingClientRect().width) * 100
        document.querySelector(".circle").style.left = percent + "%" // Corrected: use percent directly
        currentSong.currentTime = ((currentSong.duration) * percent) / 100
    })

    // Hamburger and close button functionality
    document.querySelector(".hamburger").addEventListener("click", () => {
        document.querySelector(".left").style.left = "0"
    })
    document.querySelector(".close").addEventListener("click", () => {
        document.querySelector(".left").style.left = "-120%"
    })

    // Event listener for previous song
    previous.addEventListener("click", () => {
        let index = songs.indexOf(currentSong.src.split("/").slice(-1)[0]);
        if ((index - 1) >= 0) {
            playMusic(songs[index - 1]);
        }
    })

    // Event listener for next song
    next.addEventListener("click", () => {
        let index = songs.indexOf(currentSong.src.split("/").slice(-1)[0]);
        if ((index + 1) < songs.length) {
            playMusic(songs[index + 1]);
        }
    })

    // Event listener for volume
    document.querySelector(".range").getElementsByTagName("input")[0].addEventListener("change", (e) => {
        currentSong.volume = parseInt(e.target.value) / 100
    })

    // Call displayAlbums 
    await displayAlbums();


    //event listner for volume slider
    const volumeImg = document.querySelector(".volume > img");
    const volumeSlider = document.querySelector(".range").getElementsByTagName("input")[0];

    volumeImg.addEventListener("click", e => {
        if (e.target.src.includes("volume.svg")) {
            previousVolume = currentSong.volume;
            currentSong.volume = 0;
            volumeSlider.value = 0;
            e.target.src = e.target.src.replace("volume.svg", "mute.svg");
        } else {
            currentSong.volume = previousVolume;
            volumeSlider.value = previousVolume * 100;
            e.target.src = e.target.src.replace("mute.svg", "volume.svg");
        }
    });

    volumeSlider.addEventListener("input", (e) => {
        const newVolume = parseInt(e.target.value) / 100;
        currentSong.volume = newVolume;

        if (newVolume > 0) {
            previousVolume = newVolume;
        }

        if (newVolume === 0) {
            volumeImg.src = volumeImg.src.replace("volume.svg", "mute.svg");
        } else {
            if (volumeImg.src.includes("mute.svg")) {
                volumeImg.src = volumeImg.src.replace("mute.svg", "volume.svg");
            }
        }
    });
}

main();