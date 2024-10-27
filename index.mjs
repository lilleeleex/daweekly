#!/usr/bin/env node


import prompts from 'prompts';
import chalk from 'chalk';
import fs from 'fs';
import ExcelJS from 'exceljs';
import Table from 'cli-table3';

const pathTools = `${process.cwd()}/datools/`;
if (!fs.existsSync(pathTools)) fs.mkdirSync(pathTools);
const pathDaWeekly = `${pathTools}daweekly/`;
if (!fs.existsSync(pathDaWeekly)) fs.mkdirSync(pathDaWeekly);
const pathSemainiers = `${pathDaWeekly}semainiers/`; // Dossier pour stocker les fichiers de semaine
if (!fs.existsSync(pathSemainiers)) fs.mkdirSync(pathSemainiers);
const pathExports = `${pathDaWeekly}exports/`; // Dossier pour stocker les exports de semaine
if (!fs.existsSync(pathExports)) fs.mkdirSync(pathExports);

// Créer le dossier s'il n'existe pas

globalThis.monSemainier = null;

// Fonction pour obtenir le numéro de la semaine actuelle
function getCurrentWeekNumber() {
    const now = new Date();
    const startOfYear = new Date(now.getFullYear(), 0, 1);
    const pastDaysOfYear = (now - startOfYear) / 86400000; // Nombre de jours passés depuis le début de l'année
    return Math.ceil((pastDaysOfYear + startOfYear.getDay() + 1) / 7);
}

// Fonction pour obtenir la date de début de la semaine
function getStartOfWeek(weekNumber, year) {
    const firstDayOfYear = new Date(year, 0, 1);
    const firstMondayOfYear = firstDayOfYear.getDay() <= 1
        ? firstDayOfYear
        : new Date(firstDayOfYear.setDate(firstDayOfYear.getDate() + (8 - firstDayOfYear.getDay())));
    return new Date(firstMondayOfYear.setDate(firstMondayOfYear.getDate() + (weekNumber - 1) * 7));
}

// Fonction pour obtenir le format de la date (JJ/MM)
function getDateString(date) {
    const day = (date.getDate()).toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    return `${day}/${month}`;
}

// Fonction utilitaire pour attendre un délai
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function createNewSemainier(startOfWeekDate, endOfWeekDate, weekNumber) {
    const daysOfWeek = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', "Samedi", "Dimanche"];

    const semainier = {
        planning: {
            Lundi: {
                planning: [],
                date: ""
            },
            Mardi: {
                planning: [],
                date: ""
            },
            Mercredi: {
                planning: [],
                date: ""
            },
            Jeudi: {
                planning: [],
                date: ""
            },
            Vendredi: {
                planning: [],
                date: ""
            },
            Samedi: {
                planning: [],
                date: ""
            },
            Dimanche: {
                planning: [],
                date: ""
            }
        },
        weekDates: {
            startOfWeekDate: getDateString(startOfWeekDate),
            endOfWeekDate: getDateString(endOfWeekDate)
        },
        weekNumber: weekNumber
    };

    for (const property in semainier.planning) {
        // Calculer l'index du jour sélectionné (ex. "Mardi" = 1)
        const selectedDayIndex = daysOfWeek.indexOf(property);

        // Calculer la date correspondant au jour sélectionné
        let selectedDayDate = new Date(startOfWeekDate);
        selectedDayDate.setDate(selectedDayDate.getDate() + selectedDayIndex);

        semainier.planning[property].date = getDateString(selectedDayDate)
    }

    return semainier;
}

// Fonction pour choisir une semaine
async function chooseWeek() {
    const currentWeekNumber = getCurrentWeekNumber();
    let startOfWeekDate = getStartOfWeek(currentWeekNumber, new Date().getFullYear());
    let endOfWeekDate = getEndOfWeekDate(startOfWeekDate);
    console.log(chalk.magenta(`🌐 S${currentWeekNumber} > ${getDateString(startOfWeekDate)} -> ${getDateString(endOfWeekDate)}`));

    const { value: action } = await prompts({
        type: 'autocomplete',
        name: 'value',
        message: `🚀 Tu veux créer, modifier, afficher, exporter une semaine ou supprimer une activité ?`,
        choices: [
            { title: `Creer une semaine`, value: 'creer' },
            { title: `Modifier une semaine`, value: 'modifier' },
            { title: `Afficher une semaine`, value: 'consulter' },
            { title: 'Supprimer une activité', value: 'supprimer' },
            { title: 'Exporter une semaine', value: 'exporter' },
        ],
        onRender(kleur) {
            this.msg = kleur.cyan(`🚀 Tu veux créer, modifier, afficher, exporter une semaine ou supprimer une activité ?`);
        },
    });

    if (action === undefined) process.exit(0);


    const libellePrompt = {
        creer: 'à créer',
        modifier: 'à modifier',
        consulter: 'à afficher',
        supprimer: 'dans laquelle supprimer une activité',
        exporter: 'à exporter'
    }

    const regex = /^(0?[1-9]|[1-4][0-9]|5[0-2])$/;

    const { value: weekNumber } = await prompts({
        type: 'number',
        name: 'value',
        message: `📅 Saisis le numéro de la semaine [1-52] ${libellePrompt[action]} :`,
        initial: currentWeekNumber,
        min: 1,
        max: 52,
        increment: 1,
        format: value => String(value),
        validate: value => regex.test(value) ? true : 'Saisis une valeur entre 1 et 52.',
        onRender(kleur) {
            this.msg = kleur.cyan(`📅 Saisis le numéro de la semaine [1-52] ${libellePrompt[action]} : `);
        },
    });

    if (weekNumber === undefined) process.exit(0);

    const weekPath = `${pathSemainiers}semaine_${weekNumber}.json`;
    startOfWeekDate = getStartOfWeek(weekNumber, new Date().getFullYear());
    endOfWeekDate = getEndOfWeekDate(startOfWeekDate);

    if (action === 'creer') {
        if (fs.existsSync(weekPath)) {
            console.log(chalk.red(`❌ Le fichier semaine ${weekNumber} (${getDateString(startOfWeekDate)} -> ${getDateString(endOfWeekDate)}) existe déjà. Choisis plutôt l'option "Modifier une semaine".`));
            return chooseWeek();
        }

        const semainier = createNewSemainier(startOfWeekDate, endOfWeekDate, weekNumber);
        globalThis.monSemainier = semainier;

        fs.writeFileSync(weekPath, JSON.stringify(semainier, null, 2));
        console.log(chalk.green(`✅ Le fichier semaine ${weekNumber} (${semainier.weekDates.startOfWeekDate} -> ${semainier.weekDates.endOfWeekDate}) est crée et chargé en mémoire de travail.`));

        selectDay(weekPath, semainier, action)
    } else if (action === 'modifier') {
        if (!fs.existsSync(weekPath)) {
            console.log(chalk.red(`❌ Le fichier semaine ${weekNumber} (${getDateString(startOfWeekDate)} -> ${getDateString(endOfWeekDate)}) n'existe pas. Choisis plutôt l'option "Créer une semaine".`));
            return chooseWeek();
        }

        const file = fs.readFileSync(weekPath, 'utf8');
        const semainier = JSON.parse(file);
        globalThis.monSemainier = semainier;

        console.log(chalk.green(`ℹ️  Le fichier semaine ${semainier.weekNumber} (${semainier.weekDates.startOfWeekDate} -> ${semainier.weekDates.endOfWeekDate}) est chargé en mémoire de travail.`));
        selectDay(weekPath, semainier, action)
    } else if (action === 'supprimer') {
        if (!fs.existsSync(weekPath)) {
            console.log(chalk.red(`❌ Le fichier semaine ${weekNumber} (${getDateString(startOfWeekDate)} -> ${getDateString(endOfWeekDate)}) n'existe pas.`));
            return chooseWeek();
        }

        const file = fs.readFileSync(weekPath, 'utf8');
        const semainier = JSON.parse(file);
        globalThis.monSemainier = semainier;
        console.log(chalk.green(`ℹ️  Le fichier semaine ${semainier.weekNumber} (${semainier.weekDates.startOfWeekDate} -> ${semainier.weekDates.endOfWeekDate}) est chargé en mémoire de travail.`));
        await removeActivity(weekPath, semainier)

        return chooseWeek();

    } else if (action === 'consulter') {
        if (!fs.existsSync(weekPath)) {
            console.log(chalk.red(`❌ Le fichier semaine ${weekNumber} (${getDateString(startOfWeekDate)} -> ${getDateString(endOfWeekDate)}) n'existe pas.`));
            return chooseWeek();
        }

        const file = fs.readFileSync(weekPath, 'utf8');
        const semainier = JSON.parse(file);
        globalThis.monSemainier = semainier;

        displaySemainier(semainier);

        return chooseWeek();
    } else if (action === 'exporter') {
        if (!fs.existsSync(weekPath)) {
            console.log(chalk.red(`❌ Le fichier semaine ${weekNumber} (${getDateString(startOfWeekDate)} -> ${getDateString(endOfWeekDate)}) n'existe pas.`));
            return chooseWeek();
        }

        const file = fs.readFileSync(weekPath, 'utf8');
        const semainier = JSON.parse(file);
        globalThis.monSemainier = semainier;

        await createCalcFile(semainier);

        return chooseWeek();
    }
}

function getEndOfWeekDate(startOfWeekDate) {
    const endOfWeekDate = new Date(startOfWeekDate);
    endOfWeekDate.setDate(endOfWeekDate.getDate() + 6); // Ajouter 6 jours pour obtenir la fin de la semaine
    return endOfWeekDate;
}

// Fonction pour sélectionner un jour de la semaine
async function selectDay(weekPath, semainier, action) {
    const days = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi'];

    const libellePrompt = {
        creer: 'ajouter des activités',
        modifier: 'ajouter des activités',
        supprimer: 'supprimer une activité',
    }

    const { value: selectedDay } = await prompts({
        type: 'autocomplete',
        name: 'value',
        message: `# S${semainier.weekNumber} > ${semainier.weekDates.startOfWeekDate} -> ${semainier.weekDates.endOfWeekDate} > Choisis le jour pour lequel tu veux ${libellePrompt[action]} :`,
        choices: days.map(day => ({ title: `${day} ${semainier.planning[day].date}`, value: day })),
        onRender(kleur) {
            this.msg = kleur.bgCyan(`# S${semainier.weekNumber} > ${semainier.weekDates.startOfWeekDate} -> ${semainier.weekDates.endOfWeekDate} > Choisis le jour pour lequel tu veux ${libellePrompt[action]} :`);
        }
    });

    if (selectedDay === undefined) process.exit(0);

    await addActivitiesForSelectedDay(weekPath, semainier, selectedDay, action);
}

// Fonction pour ajouter des activités pour le jour sélectionné
async function addActivitiesForSelectedDay(weekPath, semainier, selectedDay, action) {
    const selectedDayDate = `${semainier.planning[selectedDay].date}`;

    const libellePrompt = {
        creer: 'ajouter',
        modifier: 'ajouter',
        supprimer: 'supprimer',
    }

    let continueAdding = true;
    while (continueAdding) {
        const response = await prompts({
            type: 'text',
            name: 'activity',
            message: `# S${semainier.weekNumber} > ${semainier.weekDates.startOfWeekDate} -> ${semainier.weekDates.endOfWeekDate} > ${selectedDayDate} > Saisis l'activité que tu veux ${libellePrompt[action]} pour ${selectedDay} ${selectedDayDate} ?`,
            onRender(kleur) {
                this.msg = kleur.bgCyan(`# S${semainier.weekNumber} > ${semainier.weekDates.startOfWeekDate} -> ${semainier.weekDates.endOfWeekDate} > ${selectedDayDate} > Saisis l'activité que tu veux ${libellePrompt[action]} pour ${selectedDay} ${selectedDayDate} ?`);
            },
            validate: value => !value.match(/(\d{1,2}h\d{0,2})? .+/) ? 'L\'activité doit au moins comporter une horaire au format HhMM, Hh ou HHhMM.' : true,
        });

        if (!response.hasOwnProperty("activity")) process.exit(0);

        const activity = response.activity;

        semainier.planning[selectedDay].planning.push({ libelle: activity });

        console.log(chalk.green(`✅ Activité ajoutée pour ${selectedDay} ${selectedDayDate} : ${activity}`));

        fs.writeFileSync(weekPath, JSON.stringify(semainier, null, 2));

        let continueAsking = true;
        while (continueAsking) {
            const { value: nextStep } = await prompts({
                type: 'autocomplete',
                name: 'value',
                message: `# S${semainier.weekNumber} > ${semainier.weekDates.startOfWeekDate} -> ${semainier.weekDates.endOfWeekDate} > Que veux-tu faire maintenant ?`,
                choices: [
                    { title: `Ajouter une activité pour ${selectedDay} ${selectedDayDate}`, value: 'addMore' },
                    { title: 'Ajouter une activité pour un autre jour de la semaine', value: 'changeDay' },
                    { title: 'Afficher la semaine', value: 'show' },
                    { title: 'Revenir au menu principal', value: 'exit' },
                ],
                onRender(kleur) {
                    this.msg = kleur.bgCyan(`# S${semainier.weekNumber} > ${semainier.weekDates.startOfWeekDate} -> ${semainier.weekDates.endOfWeekDate} > Que veux-tu faire maintenant ?`);
                }
            });

            if (nextStep === undefined) process.exit(0);

            if (nextStep === 'addMore') {
                continueAsking = false;
                continueAdding = true;
            } else if (nextStep === 'changeDay') {
                continueAdding = false;
                continueAsking = false;
                await selectDay(weekPath, semainier, "modifier");
            } else if (nextStep === 'show') {
                displaySemainier(semainier);
                continueAdding = false;
                continueAsking = true;
            } else if (nextStep === 'exit') {
                return chooseWeek();
            }
        }
    }
}


// Fonction pour afficher le semainier sous forme de tableau
function displaySemainier(semainier) {
    console.log(chalk.green(`ℹ️  Activités enregistrées pour la semaine ${semainier.weekNumber} (${semainier.weekDates.startOfWeekDate} -> ${semainier.weekDates.endOfWeekDate}) :`));
    // Fonction pour extraire l'heure de début d'une activité
    const getTimeInMinutes = (activity) => {
        if (!activity) return 0;
        const [_, hours = '', minutes = ''] = activity.match(/(\d{1,2})h(\d{0,2})/) || [];
        // Convertir les heures et minutes en entier, par défaut minutes = 0 si non spécifié
        return parseInt(hours) * 60 + (parseInt(minutes) || 0);
    };

    // Préparer les données pour l'affichage en tableau
    const days = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi'];
    const table = new Table({
        head: days,
        chars: {
            'top': '═', 'top-mid': '╤', 'top-left': '╔', 'top-right': '╗'
            , 'bottom': '═', 'bottom-mid': '╧', 'bottom-left': '╚', 'bottom-right': '╝'
            , 'left': '║', 'left-mid': '╟', 'mid': '─', 'mid-mid': '┼'
            , 'right': '║', 'right-mid': '╢', 'middle': '│'
        },
        colWidths: new Array(days.length).fill(20)
    });

    for (const day in semainier.planning) {
        semainier.planning[day].planning.sort((a, b) => {
            return getTimeInMinutes(a?.libelle) - getTimeInMinutes(b?.libelle);
        });
    }

    // Trouver le nombre maximum d'activités dans un jour
    const maxActivities = Math.max(...days.map(day => semainier.planning[day].planning.length));
    // Ajouter les activités dans le tableau
    for (let i = 0; i < maxActivities; i++) {
        const row = days.map(day => semainier.planning[day].planning[i] ? semainier.planning[day].planning[i].libelle : '');
        table.push(row);
    }
    console.log(table.toString());
}

// Fonction pour supprimer une activité
async function removeActivity(weekPath, semainier) {
    // Sélectionner le jour
    const { value: selectedDay } = await prompts({
        type: 'autocomplete',
        name: 'value',
        message: 'Choisis le jour pour lequel tu veux supprimer une activité :',
        choices: ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi'].map(day => ({ title: `${day} ${semainier.planning[day].date}`, value: day })),
        onRender(kleur) {
            this.msg = kleur.bgCyan(`# S${semainier.weekNumber} > ${semainier.weekDates.startOfWeekDate} -> ${semainier.weekDates.endOfWeekDate} > Choisis le jour pour lequel tu veux supprimer une activité :`);
        },
    });

    if (selectedDay === undefined) process.exit(0);

    const selectedDayDate = `${semainier.planning[selectedDay].date}`;

    // Afficher les activités existantes pour le jour sélectionné
    const activities = semainier.planning[selectedDay].planning;
    if (activities.length === 0) {
        console.log(chalk.red(`ℹ️  Aucune activité enregistrée pour ${selectedDay} ${selectedDayDate}.`));
        return chooseWeek();
    }

    console.log(chalk.green(`ℹ️  Activités enregistrées pour ${selectedDay} ${selectedDayDate} :`));
    activities.forEach((activity, index) => {
        console.log(`${index + 1}. ${activity.libelle}`);
    });

    // Demander l'index de l'activité à supprimer
    const { value: activityIndex } = await prompts({
        type: 'number',
        name: 'value',
        message: `# S${semainier.weekNumber} > ${semainier.weekDates.startOfWeekDate} -> ${semainier.weekDates.endOfWeekDate} > ${selectedDayDate} > Saisis le numéro de l'activité à supprimer [1-${activities.length}] :`,
        format: value => String(value),
        min: 1,
        max: activities.length,
        onRender(kleur) {
            this.msg = kleur.bgCyan(`# S${semainier.weekNumber} > ${semainier.weekDates.startOfWeekDate} -> ${semainier.weekDates.endOfWeekDate} > ${selectedDayDate} > Saisis le numéro de l'activité à supprimer [1-${activities.length}] :`);
        }
    });

    if (activityIndex === undefined) process.exit(0);

    const indexToRemove = Number(activityIndex) - 1;

    // Supprimer l'activité
    const removedActivity = activities.splice(indexToRemove, 1);
    fs.writeFileSync(weekPath, JSON.stringify(semainier, null, 2));

    console.log(chalk.green(`✅ Activité supprimée pour ${selectedDay} ${selectedDayDate} : ${removedActivity[0].libelle}`));
}

async function createCalcFile(semainier) {
    const getTimeInMinutes = (libelle) => {
        if (!libelle) return 0;
        const [_, hours = '', minutes = ''] = libelle.match(/(\d{1,2})h(\d{0,2})/) || [];
        // Convertir les heures et minutes en entier, par défaut minutes = 0 si non spécifié
        return parseInt(hours) * 60 + (parseInt(minutes) || 0);
    };

    function sortAndSeparateActivities(activites, moment) {
        const morningEndTime = getTimeInMinutes('12h00');

        const _activites = JSON.parse(JSON.stringify(activites));
        // Trier les activités par heure
        _activites.sort((a, b) => getTimeInMinutes(a.libelle) - getTimeInMinutes(b.libelle));

        // Séparer les activités en matin et après-midi
        if (moment === "matin") return _activites.filter(a => getTimeInMinutes(a.libelle) <= morningEndTime);
        if (moment === "apresMidi") return _activites.filter(a => getTimeInMinutes(a.libelle) > morningEndTime);
    }

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet(`Semaine ${semainier.weekNumber}`);

    worksheet.columns = [
        { header: '', key: 'moment', width: 15 },
        { header: `Lundi ${semainier.planning["Lundi"].date}`, key: 'lundi', width: 20 },
        { header: `Mardi ${semainier.planning["Mardi"].date}`, key: 'mardi', width: 20 },
        { header: `Mercredi ${semainier.planning["Mercredi"].date}`, key: 'mercredi', width: 20 },
        { header: `Jeudi ${semainier.planning["Jeudi"].date}`, key: 'jeudi', width: 20 },
        { header: `Vendredi ${semainier.planning["Vendredi"].date}`, key: 'vendredi', width: 20 }
    ];

    const moments = ['Matin', 'Après-midi'];
    moments.forEach(moment => {
        const row = { moment };
        ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi'].forEach(day => {
            if (moment === "Matin") {
                row[day.toLowerCase()] = sortAndSeparateActivities(semainier.planning[day].planning, "matin")
                    ?.map(activity => activity.libelle)?.join('\n'); // Utiliser \n pour séparer les activités dans la même cellule
            }
            if (moment === "Après-midi") {
                row[day.toLowerCase()] = sortAndSeparateActivities(semainier.planning[day].planning, "apresMidi")
                    ?.map(activity => activity.libelle)?.join('\n'); // Utiliser \n pour séparer les activités dans la même cellule
            }
        });
        worksheet.addRow(row);
    });

    // Ajuster la hauteur des lignes pour afficher toutes les activités
    worksheet.eachRow({ includeEmpty: true }, function (row) {
        row.height = 20 * row.cellCount;
        row.alignment = { wrapText: true }; // Activer le retour à la ligne
        row.eachCell({ includeEmpty: true }, function (cell) {
            cell.alignment = { vertical: 'middle', horizontal: 'center' }; // Centrer horizontalement et verticalement
        });
    });

    const filePath = `${pathExports}semaine_${semainier.weekNumber}.xlsx`;
    const message = fs.existsSync(filePath) ? `✅ Le fichier Excel semaine ${semainier.weekNumber} a été mis à jour : ${filePath}` : `✅ Le fichier Excel semaine ${semainier.weekNumber} a été crée : ${filePath}`;
    await workbook.xlsx.writeFile(filePath);

    console.log(chalk.green(message));
}

// Lancer le choix de la semaine
chooseWeek().catch(err => {
    console.error(err);
    process.exit(0);
});

process.on("exit", (code) => {
    if (!globalThis.monSemainier?.hasOwnProperty("planning")) return;
    displaySemainier(globalThis.monSemainier);
});