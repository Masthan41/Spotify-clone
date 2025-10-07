console.log('lets write java script');
let currentSong = new Audio();
let songs; // Declared globally
let currFolder;
let play, previous, next;
let previousVolume = 1;

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
        try {
            // Prefer the href attribute; fallback to textContent
            let raw = element.getAttribute('href') || element.href || element.textContent || '';
            if (!raw) continue;
            // Normalize backslashes to forward slashes (some server listings use Windows-style paths)
            raw = raw.replace(/\\/g, '/');
            // Only consider entries that look like mp3 links
            if (!/\.mp3$/i.test(raw)) continue;

            // Take the last path segment as the filename
            const parts = raw.split('/').filter(Boolean);
            let filename = parts.pop();

            // If filename contains encoded percent signs like '%25', decode once to normalize
            try {
                let iter = 0;
                while (/%25/i.test(filename) && iter < 3) {
                    filename = decodeURIComponent(filename);
                    iter++;
                }
                // Also decode any remaining percent-encodings (safe fallback)
                filename = decodeURIComponent(filename);
            } catch (e) {
                // If decodeURIComponent fails, fall back to raw filename
            }

            // Finally, trim any stray folder prefixes (e.g., 'songs/' or '\\') from filename
            filename = filename.replace(/^.*[\\/]/, '');

            if (filename) songsArray.push(filename);
        } catch (err) {
            // ignore malformed hrefs
        }
    }
    return songsArray
}

const playMusic = (track, pause = false) => {
    if (!track) {
        console.warn('playMusic called without a valid track');
        document.querySelector('.songinfo').innerHTML = 'No track selected';
        document.querySelector('.songtime').innerHTML = '00:00 / 00:00';
        if (typeof play !== 'undefined' && play) play.src = 'play.svg';
        return;
    }
    // Build a safe, encoded URL for the audio source.
    // Normalize currFolder to remove leading/trailing slashes, then encode only the filename portion.
    const normalizedFolder = String(currFolder).replace(/^\/+|\/+$/g, '');
    const encodedFilename = encodeURIComponent(track);
    const src = `/${normalizedFolder}/${encodedFilename}`;
    console.log('Setting audio src to', src);
    currentSong.src = src;
    // Load the source explicitly
    try {
        currentSong.load();
    } catch (e) {
        console.warn('Error calling load() on audio element', e);
    }

    if (!pause) {
        const playPromise = currentSong.play();
        if (playPromise !== undefined) {
            playPromise.catch(err => {
                console.warn('Audio playback failed (promise rejection):', err);
            }).then(() => {
                if (typeof play !== 'undefined' && play) play.src = "pause.svg";
            });
        } else {
            if (typeof play !== 'undefined' && play) play.src = "pause.svg";
        }
    }
    document.querySelector(".songinfo").innerHTML = decodeURI(track)
    document.querySelector(".songtime").innerHTML = "00:00 / 00:00"
}

// Debugging: log key audio events
currentSong.addEventListener('play', () => console.log('Audio element event: play'));
currentSong.addEventListener('error', (e) => console.error('Audio element error event:', e));
currentSong.addEventListener('loadedmetadata', () => console.log('Audio element loadedmetadata, duration:', currentSong.duration));


// Function to display the list of songs in the sidebar
function displaySongsInPlaylist(songsToDisplay) {
    let songUL = document.querySelector(".songList").getElementsByTagName("ul")[0];
    songUL.innerHTML = ""; // Clear existing songs
    // Ensure we only render valid, non-empty tracks
    const validSongs = Array.isArray(songsToDisplay) ? songsToDisplay.filter(Boolean) : [];

    for (const song of validSongs) {
        const displayName = decodeURIComponent(song);
        // store the raw track filename in a data attribute so click handlers can use it directly
        songUL.innerHTML += `<li data-track="${song}"><img class="invert" width="34" src="music.svg" alt="">
                                <div class="info">
                                    <div> ${displayName}</div>
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
            const track = e.dataset.track;
            if (track) {
                playMusic(track);
            }
        });
    });
}


async function displayAlbums() {
    console.log("displaying albums")
    let a = await fetch(`http://127.0.0.1:3000/songs/`)
    let response = await a.text();
    console.log('Raw /songs/ response (first 1000 chars):', response.slice(0, 1000));
    let div = document.createElement("div")
    div.innerHTML = response;
    let anchors = div.getElementsByTagName("a")
    let cardContainer = document.querySelector(".cardContainer")
    cardContainer.innerHTML = "";
    // Debug: how many anchors and a sample
    console.log(`Found ${anchors.length} anchors when listing /songs/`);

    // Extract unique folder names under /songs/ robustly
    const folders = new Set();
    Array.from(anchors).forEach(e => {
        try {
            const url = new URL(e.href, window.location.href);
            const parts = url.pathname.split('/').filter(Boolean);
            const songsIndex = parts.indexOf('songs');
            if (songsIndex !== -1 && parts.length > songsIndex + 1) {
                const folder = parts[songsIndex + 1];
                // Skip parent dir links like '.' or '..'
                if (folder && folder !== '.' && folder !== '..') folders.add(folder);
            }
        } catch (err) {
            // ignore malformed hrefs
        }
    });

    if (folders.size === 0) {
        console.warn('No song folders found under /songs/. Check the server response or paths.');
        // Try a fallback JSON file shipped in the repo (useful when directory listing is disabled)
        try {
            // Try a few common fallback paths and log results so user can see which one (if any) works
            const fallbackPaths = ['/songs/albums.json', 'songs/albums.json', './songs/albums.json'];
            let fallback = null;
            let fallbackResp = null;
            for (const p of fallbackPaths) {
                try {
                    console.log('Trying fallback path for albums.json:', p);
                    fallbackResp = await fetch(p);
                    console.log(` -> ${p} status:`, fallbackResp.status);
                    if (fallbackResp.ok) {
                        fallback = await fallbackResp.json();
                        console.log('Loaded fallback albums.json from', p);
                        break;
                    }
                } catch (e) {
                    console.warn('Fetch failed for', p, e);
                }
            }
            if (fallback) {
                const html = fallback.map(item => `
                    <div data-folder="${item.folder}" class="card">
                        <div class="play">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none"
                                xmlns="http://www.w3.org/2000/svg">
                                <path d="M5 20V4L19 12L5 20Z" stroke="#141B34" fill="#000" stroke-width="1.5"
                                    stroke-linejoin="round" />
                            </svg>
                        </div>
                        <img src="/songs/${item.folder}/cover.jpg" alt="">
                        <h2>${item.title}</h2>
                        <p>${item.description}</p>
                    </div>`).join('');
                cardContainer.innerHTML = html;
                document.querySelectorAll('.card').forEach(e => {
                    e.addEventListener('click', async item => {
                        const folder = item.currentTarget.dataset.folder;
                        console.log('Fetching Songs for folder (fallback):', folder);
                        songs = await getSongs(`songs/${folder}`);
                        if (Array.isArray(songs) && songs.length > 0) {
                            playMusic(songs[0]);
                        }
                        displaySongsInPlaylist(songs);
                    });
                });
                return;
            }
        } catch (err) {
            console.warn('Fallback albums.json not available or failed to load', err);
        }

        cardContainer.innerHTML = '<p>No albums found. Make sure the server at 127.0.0.1:3000 exposes /songs/ and each album contains an info.json.</p>';
        return;
    }

    const albumPromises = Array.from(folders).map(async folder => {
        try {
            const infoUrl = `http://127.0.0.1:3000/songs/${folder}/info.json`;
            const infoResponse = await fetch(infoUrl);
            if (!infoResponse.ok) {
                console.error(`Failed to fetch info.json for folder: ${folder} (status ${infoResponse.status})`);
                return null;
            }
            const responseJson = await infoResponse.json();
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
    });

    const albumHtmls = await Promise.all(albumPromises);
    cardContainer.innerHTML = albumHtmls.filter(html => html !== null).join('');

    // attach event listeners to created cards
    document.querySelectorAll('.card').forEach(e => {
        e.addEventListener('click', async item => {
            const folder = item.currentTarget.dataset.folder;
            console.log('Fetching Songs for folder:', folder);
            songs = await getSongs(`songs/${folder}`);
            if (Array.isArray(songs) && songs.length > 0) {
                playMusic(songs[0]);
            }
            displaySongsInPlaylist(songs);
        });
    });
}


async function main() {
    // Initialize DOM references used across functions
    play = document.getElementById('play');
    previous = document.getElementById('previous');
    next = document.getElementById('next');

    // ensure we have a sensible default previous volume
    previousVolume = currentSong.volume || previousVolume;
    // Get the initial list of songs
    songs = await getSongs("songs/ncs")
    if (Array.isArray(songs) && songs.length > 0) {
        playMusic(songs[0], true)
    } else {
        console.warn('No initial songs found for songs/ncs');
        document.querySelector('.songinfo').innerHTML = 'No songs available';
    }
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
        const duration = currentSong.duration || 0;
        const current = currentSong.currentTime || 0;
        const percent = duration ? (current / duration) * 100 : 0;
        document.querySelector(".songtime").innerHTML = `${secondsToMinutesSeconds(current)}/${secondsToMinutesSeconds(duration)}`
        document.querySelector(".circle").style.left = percent + "%"
    })

    // add Event listener to seek bar
    document.querySelector(".seekbar").addEventListener("click", e => {
        // Use bounding rect and clientX to compute a stable percentage even if inner elements are clicked
        const rect = e.currentTarget.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const percent = (clickX / rect.width) * 100;
        document.querySelector(".circle").style.left = percent + "%"
        const duration = currentSong.duration || 0;
        currentSong.currentTime = duration ? (duration * percent) / 100 : 0;
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