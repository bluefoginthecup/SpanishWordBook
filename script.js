const verbs = [];
let currentVerb = null;

function uploadExcel(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });

        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const json = XLSX.utils.sheet_to_json(sheet);

        json.forEach(row => {
            verbs.push({
                infinitive: row.Infinitive,
                present: row.Present.split(","),
                past: row.Past.split(","),
                imperfect: row.Imperfect.split(","),
                future: row.Future.split(","),
                meaning: row.Meaning,
                image: row.Image
            });
        });

        saveToFirebase();
        filterVerbs();
    };
    reader.readAsArrayBuffer(file);
}

function filterVerbs() {
    const search = document.getElementById('search').value.toLowerCase();
    const verbList = document.getElementById('verb-list');
    const verbCount = document.getElementById('verb-count');

    verbList.innerHTML = '';
    const filteredVerbs = verbs.filter(verb =>
        verb.infinitive.includes(search) ||
        (verb.meaning && verb.meaning.toLowerCase().includes(search))
    );

    verbCount.textContent = filteredVerbs.length;

    filteredVerbs.forEach(verb => {
        const li = document.createElement('li');
        li.textContent = `${verb.infinitive} (${verb.meaning || 'N/A'})`;
        li.onclick = () => showVerbDetails(verb);

        const deleteButton = document.createElement('button');
        deleteButton.textContent = 'Delete';
        deleteButton.onclick = (e) => {
            e.stopPropagation();
            const index = verbs.indexOf(verb);
            verbs.splice(index, 1);
            saveToFirebase();
            filterVerbs();
        };

        li.appendChild(deleteButton);
        verbList.appendChild(li);
    });
}

function deleteAllVerbs() {
    if (confirm('Are you sure you want to delete all verbs?')) {
        verbs.length = 0;
        saveToFirebase();
        filterVerbs();
        document.getElementById('verb-details').style.display = 'none';
    }
}

function resetFileUpload() {
    document.getElementById('file-upload').value = "";
}

function showVerbDetails(verb) {
    currentVerb = verb;
    const verbDetails = document.getElementById('verb-details');
    verbDetails.style.display = 'block';

    document.getElementById('verb-infinitive').textContent = `${verb.infinitive} (${verb.meaning || 'N/A'})`;

    const conjugations = document.getElementById('verb-conjugations');
    conjugations.innerHTML = '';

    ['present', 'past', 'imperfect', 'future'].forEach(tense => {
        verb[tense].forEach((conjugation, index) => {
            let row = conjugations.querySelector(`tr:nth-child(${index + 1})`);
            if (!row) {
                row = document.createElement('tr');
                const personCell = document.createElement('td');
                personCell.textContent = ['Yo', 'Tú', 'Él/Ella/Usted', 'Nosotros/as', 'Vosotros/as', 'Ellos/Ellas/Ustedes'][index];
                row.appendChild(personCell);
                conjugations.appendChild(row);
            }

            const cell = document.createElement('td');
            cell.contentEditable = true;
            cell.textContent = conjugation || '-';
            cell.addEventListener('input', () => {
                verb[tense][index] = cell.textContent;
                saveToFirebase();
            });
            row.appendChild(cell);
        });
    });
}

function speakVerb() {
    const verbInfinitive = document.getElementById('verb-infinitive').textContent.split(' ')[0];
    if ('speechSynthesis' in window) {
        const utterance = new SpeechSynthesisUtterance(verbInfinitive);
        utterance.lang = 'es-ES';
        window.speechSynthesis.speak(utterance);
    } else {
        alert('Speech synthesis not supported in this browser.');
    }
}

function saveChanges() {
    if (currentVerb) {
        alert('Changes saved successfully!');
        saveToFirebase();
    } else {
        alert('No verb selected to save.');
    }
}

function downloadExcel() {
    const worksheetData = verbs.map(verb => ({
        Infinitive: verb.infinitive,
        Present: verb.present.join(","),
        Past: verb.past.join(","),
        Imperfect: verb.imperfect.join(","),
        Future: verb.future.join(","),
        Meaning: verb.meaning,
        Image: verb.image
    }));

    const worksheet = XLSX.utils.json_to_sheet(worksheetData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Verbs");
    XLSX.writeFile(workbook, "verbs.xlsx");
}

function saveToFirebase() {
    if (typeof firebase === "undefined") {
        console.error("Firebase is not defined. Ensure Firebase SDK is properly loaded.");
        return;
    }

    firebase.database().ref('verbs').set(verbs);
}

function loadFromFirebase() {
    if (typeof firebase === "undefined") {
        console.error("Firebase is not defined. Ensure Firebase SDK is properly loaded.");
        return;
    }

    firebase.database().ref('verbs').once('value', (snapshot) => {
        const data = snapshot.val();
        if (data) {
            verbs.push(...data);
            filterVerbs();
        }
    });
}

// Send to Firebase 버튼 이벤트 핸들러
document.getElementById('send-to-firebase').addEventListener('click', () => {
    if (typeof firebase === 'undefined') {
        console.error("Firebase is not defined. Ensure Firebase SDK is properly loaded.");
        return;
    }

    firebase.database().ref('verbs').set(verbs)
        .then(() => {
            alert('Data successfully sent to Firebase!');
        })
        .catch((error) => {
            console.error('Error sending data to Firebase:', error);
            alert('Failed to send data to Firebase.');
        });
});

// 페이지 로드 시 데이터 로드
window.onload = loadFromFirebase;
