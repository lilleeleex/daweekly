#!/usr/bin/env node


import prompts from 'prompts';
import chalk from 'chalk';
import fs from 'fs';

import Table from 'cli-table3';

const path = './semainiers/'; // Dossier pour stocker les fichiers de semaine

// Créer le dossier s'il n'existe pas
if (!fs.existsSync(path)) {
    fs.mkdirSync(path);
}

globalThis.monSemainier = null;

// Fonction pour obtenir le numéro de la semaine actuelle
function getCurrentWeekNumber() {
    const now = new Date();
    const startOfYear = new Date(now.getFullYear(), 0, 1);
    const pastDaysOfYear = (now - startOfYear) / 86400000; // Nombre de jours passés depuis le début de l'année
    return Math.floor((pastDaysOfYear + startOfYear.getDay() + 1) / 7);
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

// Fonction pour convertir le format de l'heure
function convertTimeFormat(time) {
    return time.replace('h', ':');
}

// Fonction utilitaire pour attendre un délai
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function createNewSemainier(startOfWeekDate, endOfWeekDate, weekNumber) {
    const daysOfWeek = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', "Samedi", "Dimanche"];

    const semainier = {
        planning: {
            Lundi: {},
            Mardi: {},
            Mercredi: {},
            Jeudi: {},
            Vendredi: {},
            Samedi: {},
            Dimanche: {}
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

        semainier.planning[property] = {
            planning: [],
            date: getDateString(selectedDayDate)
        };

    }

    return semainier;
}

// Fonction pour choisir une semaine
async function chooseWeek() {
    const currentWeekNumber = getCurrentWeekNumber();
    const startOfWeekDate = getStartOfWeek(currentWeekNumber, new Date().getFullYear());
    const endOfWeekDate = getEndOfWeekDate(startOfWeekDate)

    console.log(chalk.magenta(`🌐 S${currentWeekNumber} > ${getDateString(startOfWeekDate)} -> ${getDateString(endOfWeekDate)}`));

    const { value: action } = await prompts({
        type: 'autocomplete',
        name: 'value',
        message: `🚀  Tu veux créer, modifier, afficher une semaine ou supprimer une activité ?`,
        choices: [
            { title: `Creer une semaine`, value: 'creer' },
            { title: `Modifier une semaine`, value: 'modifier' },
            { title: `Afficher une semaine`, value: 'consulter' },
            { title: 'Supprimer une activité', value: 'supprimer' },
        ],
        onRender(kleur) {
            this.msg = kleur.cyan(`🚀 Tu veux créer, modifier, afficher une semaine ou supprimer une activité ?`);
        },
        validate: value => {
            console.log(value);
            return true
        },
    });

    let weekNumber;
    if (action === 'creer' || action === 'modifier' || action === 'consulter') {
        const actionTitle = {
            creer: 'créer',
            modifier: 'modifier',
            consulter: 'afficher'
        }
        const regex = /^(0?[1-9]|[1-4][0-9]|5[0-2])$/;
        const response = await prompts({
            type: 'number',
            name: 'weekNumber',
            message: `📅 Saisis le numéro de la semaine [1-52] à ${actionTitle[action]} : `,
            initial: currentWeekNumber,
            min: 1,
            max: 52,
            increment: 1,
            validate: value => regex.test(value) ? true : 'Saisis une valeur entre 1 et 52 !',
            onRender(kleur) {
                this.msg = kleur.cyan(`📅 Saisis le numéro de la semaine [1-52] à ${actionTitle[action]} : `);
            },
        });
        if (!response?.hasOwnProperty('weekNumber')) process.exit(0);// Retourner au menu principal

        weekNumber = String(response.weekNumber);
    }


    if (action === 'creer') {
        const weekPath = `${path}semainier_semaine_${weekNumber}.json`;
        const startOfWeekDate = getStartOfWeek(weekNumber, new Date().getFullYear());
        const endOfWeekDate = getEndOfWeekDate(startOfWeekDate);

        if (fs.existsSync(weekPath)) {
            console.log(chalk.red(`✅ le fichier de la semaine ${weekNumber} (${getDateString(startOfWeekDate)} -> ${getDateString(endOfWeekDate)}) existe déjà. Choisis plutôt l'option "Modifier une semaine" ;)`));
            return chooseWeek().catch(err => {
                if (err.message !== 'Terminer') {
                    console.error(err);
                }
            }); // Retourner au menu principal
        }

        const semainier = createNewSemainier(startOfWeekDate, endOfWeekDate, weekNumber);
        globalThis.monSemainier = semainier;

        fs.writeFileSync(weekPath, JSON.stringify(semainier, null, 2));
        console.log(chalk.green(`✅ le fichier de la semaine ${weekNumber} (${getDateString(startOfWeekDate)} -> ${getDateString(endOfWeekDate)}) est crée.`));
        selectDay(weekPath, semainier)
    } else if (action === 'modifier') {
        const weekPath = `${path}semainier_semaine_${weekNumber}.json`;

        try {
            const file = fs.readFileSync(weekPath, 'utf8');
            const semainier = JSON.parse(file);
            globalThis.monSemainier = semainier;
            console.log(chalk.green(`✅ le fichier de la semaine ${semainier.weekNumber} (${semainier.weekDates.startOfWeekDate} -> ${semainier.weekDates.endOfWeekDate}) est chargé.`));
            await addActivityForExistingWeek(weekPath, semainier);
        }
        catch (err) {
            if (err.code !== 'ENOENT') process.exit(0);
            const startOfWeekDate = getStartOfWeek(weekNumber, new Date().getFullYear());
            const endOfWeekDate = getEndOfWeekDate(startOfWeekDate);
            console.log(chalk.red(`✅ le fichier de la semaine ${weekNumber} (${getDateString(startOfWeekDate)} -> ${getDateString(endOfWeekDate)}) n'existe pas. Choisis plutôt l'option "Créer une semaine" ;)`));
        }
        return chooseWeek().catch(err => {
            if (err.message !== 'Terminer') {
                console.error(err);
            }
        }); // Retourner au menu principal

    } else if (action === 'supprimer') {
        const weekPath = `${path}semainier_semaine_${weekNumber}.json`;
        await removeActivity();
    } else if (action === 'consulter') {
        const weekPath = `${path}semainier_semaine_${weekNumber}.json`;
        try {
            const file = fs.readFileSync(weekPath, 'utf8');
            const semainier = JSON.parse(file);
            globalThis.monSemainier = semainier;
            displaySemainier(semainier);
        }
        catch (err) {
            if (err.code !== 'ENOENT') process.exit(0);
            const startOfWeekDate = getStartOfWeek(weekNumber, new Date().getFullYear());
            const endOfWeekDate = getEndOfWeekDate(startOfWeekDate);
            console.log(chalk.red(`✅ le fichier de la semaine ${weekNumber} (${getDateString(startOfWeekDate)} -> ${getDateString(endOfWeekDate)}) n'existe pas. Choisis plutôt l'option "Créer une semaine" ;)`));
        }
        return chooseWeek().catch(err => {
            if (err.message !== 'Terminer') {
                console.error(err);
            }
        }); // Retourner au menu principal
    }
}

function getEndOfWeekDate(startOfWeekDate) {
    const endOfWeekDate = new Date(startOfWeekDate);
    endOfWeekDate.setDate(endOfWeekDate.getDate() + 6); // Ajouter 6 jours pour obtenir la fin de la semaine
    return endOfWeekDate;
}

// Fonction pour ajouter une nouvelle activité à une semaine existante
async function addActivityForExistingWeek(weekPath, semainier) {
    const days = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi'];
    const { value: selectedDay } = await prompts({
        type: 'autocomplete',
        name: 'value',
        message: `# S${semainier.weekNumber} > ${semainier.weekDates.startOfWeekDate} -> ${semainier.weekDates.endOfWeekDate} > Sélectionnes le jour pour lequel tu souhaites ajouter une activité :`,
        choices: days.map(day => ({ title: `${day} ${semainier.planning[day].date}`, value: day })),
        onRender(kleur) {
            this.msg = kleur.bgCyan(`# S${semainier.weekNumber} > ${semainier.weekDates.startOfWeekDate} -> ${semainier.weekDates.endOfWeekDate} > Sélectionnes le jour pour lequel tu souhaites ajouter une activité :`);
        }
    });

    const selectedDayDate = `${semainier.planning[selectedDay].date}`;

    //console.log(chalk.blue(`Jour sélectionné : ${selectedDay} ${selectedDayDate}`));

    let continueAdding = true;
    while (continueAdding) {
        let continueAsking = true;
        const response = await prompts({
            type: 'text',
            name: 'activity',
            message: `# S${semainier.weekNumber} > ${semainier.weekDates.startOfWeekDate} -> ${semainier.weekDates.endOfWeekDate} > ${selectedDayDate} > Quelle est l'activité que tu veux ajouter pour ${selectedDay} ${selectedDayDate} ?`,
            onRender(kleur) {
                this.msg = kleur.bgCyan(`# S${semainier.weekNumber} > ${semainier.weekDates.startOfWeekDate} -> ${semainier.weekDates.endOfWeekDate} > ${selectedDayDate} > Quelle est l'activité que tu veux ajouter pour ${selectedDay} ${selectedDayDate} ?`);
            }
        });

        if (!response.hasOwnProperty("activity")) process.exit(0);// Retourner au menu principal

        const activity = response.activity;

        semainier.planning[selectedDay].planning.push({ activite: activity });

        console.log(chalk.green(`✅ Activité ajoutée pour ${selectedDay} ${selectedDayDate} : ${activity}`));

        fs.writeFileSync(weekPath, JSON.stringify(semainier, null, 2));

        while (continueAsking) {
            continueAsking = false;

            const { value: nextStep } = await prompts({
                type: 'autocomplete',
                name: 'value',
                message: `# S${semainier.weekNumber} > ${semainier.weekDates.startOfWeekDate} -> ${semainier.weekDates.endOfWeekDate} > Que veux-tu tu faire maintenant ?`,
                choices: [
                    { title: `Ajouter une activité pour ${selectedDay} ${selectedDayDate}`, value: 'addMore' },
                    { title: 'Selectionner un autre jour de la semaine', value: 'changeDay' },
                    { title: 'Afficher la semaine', value: 'show' },
                ],
                onRender(kleur) {
                    this.msg = kleur.bgCyan(`# S${semainier.weekNumber} > ${semainier.weekDates.startOfWeekDate} -> ${semainier.weekDates.endOfWeekDate} > Que veux-tu faire maintenant ?`);
                }
            });

            if (nextStep === undefined) process.exit(0);// Retourner au menu principal

            if (nextStep === 'addMore') {
                continueAdding = true;
            } else if (nextStep === 'changeDay') {
                await selectDay(weekPath, semainier);
                continueAdding = false;
            } else if (nextStep === 'show') {
                continueAsking = true;
                await sleep(200); // Attendre 1 seconde avant d'afficher le semainier
                displaySemainier(semainier); // Afficher le semainier avant de terminer
                continueAdding = false;
            }
        }
    }
}

// Fonction pour sélectionner un jour de la semaine
async function selectDay(weekPath, semainier) {
    const days = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi'];

    const { value: selectedDay } = await prompts({
        type: 'autocomplete',
        name: 'value',
        message: `# S${semainier.weekNumber} > ${semainier.weekDates.startOfWeekDate} -> ${semainier.weekDates.endOfWeekDate} > Sélectionnes le jour pour lequel tu souhaites ajouter des activités :`,
        choices: days.map(day => ({ title: `${day} ${semainier.planning[day].date}`, value: day })),
        onRender(kleur) {
            this.msg = kleur.bgCyan(`# S${semainier.weekNumber} > ${semainier.weekDates.startOfWeekDate} -> ${semainier.weekDates.endOfWeekDate} > Sélectionnes le jour pour lequel tu souhaites ajouter des activités :`);
        }
    });

    if (selectedDay === undefined) process.exit(0);// Retourner au menu principal

    //console.log(chalk.blue(`Jour sélectionné : ${selectedDay} ${semainier.planning[selectedDay].date}`));
    await addActivitiesForDay(weekPath, semainier, selectedDay);
}

// Fonction pour ajouter des activités pour le jour sélectionné
async function addActivitiesForDay(weekPath, semainier, selectedDay) {
    const selectedDayDate = `${semainier.planning[selectedDay].date}`;

    let continueAdding = true;
    while (continueAdding) {
        let continueAsking = true;
        const reponse = await prompts({
            type: 'text',
            name: 'activity',
            message: `# S${semainier.weekNumber} > ${semainier.weekDates.startOfWeekDate} -> ${semainier.weekDates.endOfWeekDate} > ${selectedDayDate} > Quelle est l'activité que tu veux ajouter pour ${selectedDay} ${selectedDayDate} ?`,
            onRender(kleur) {
                this.msg = kleur.bgCyan(`# S${semainier.weekNumber} > ${semainier.weekDates.startOfWeekDate} -> ${semainier.weekDates.endOfWeekDate} > ${selectedDayDate} > Quelle est l'activité que tu veux ajouter pour ${selectedDay} ${selectedDayDate} ?`);
            }
        });

        if (!reponse.hasOwnProperty("activity")) process.exit(0);// Retourner au menu principal

        const activity = reponse.activity;

        semainier.planning[selectedDay].planning.push({ activite: activity });

        console.log(chalk.green(`✅ Activité ajoutée pour ${selectedDay} ${selectedDayDate} : ${activity}`));

        fs.writeFileSync(weekPath, JSON.stringify(semainier, null, 2));

        while (continueAsking) {
            continueAsking = false;

            const { value: nextStep } = await prompts({
                type: 'autocomplete',
                name: 'value',
                message: `# S${semainier.weekNumber} > ${semainier.weekDates.startOfWeekDate} -> ${semainier.weekDates.endOfWeekDate} > Que veux-tu faire maintenant ?`,
                choices: [
                    { title: `Ajouter une activité pour ${selectedDay} ${selectedDayDate}`, value: 'addMore' },
                    { title: 'Ajouter une activité pour un autre jour de la semaine', value: 'changeDay' },
                    { title: 'Afficher la semaine', value: 'show' },
                ],
                onRender(kleur) {
                    this.msg = kleur.bgCyan(`# S${semainier.weekNumber} > ${semainier.weekDates.startOfWeekDate} -> ${semainier.weekDates.endOfWeekDate} > Que veux-tu faire maintenant ?`);
                }
            });

            if (nextStep === undefined) process.exit(0);// Retourner au menu principal

            if (nextStep === 'addMore') {
                continueAdding = true;
            } else if (nextStep === 'changeDay') {
                await selectDay(weekPath, semainier);
                continueAdding = false;
            } else if (nextStep === 'show') {
                continueAsking = true;
                await sleep(200); // Attendre 1 seconde avant d'afficher le semainier
                displaySemainier(semainier); // Afficher le semainier avant de terminer
                continueAdding = false;
            }
        }
    }
}


// Fonction pour afficher le semainier sous forme de tableau
function displaySemainier(semainier) {
    console.log(chalk.green(`✅ Voilà ta semaine ${semainier.weekNumber} (${semainier.weekDates.startOfWeekDate} -> ${semainier.weekDates.endOfWeekDate}) :`));
    // Fonction pour extraire l'heure de début d'une activité
    const getTimeInMinutes = (activity) => {
        if (!activity) return 0;
        const [_, hours = '', minutes = ''] = activity.match(/(\d{1,2})h(\d{0,2})/) || [];
        // Convertir les heures et minutes en entier, par défaut minutes = 0 si non spécifié
        return parseInt(hours) * 60 + (parseInt(minutes) || 0);
    };

    // Trier les activités par heure de début
    // for (const day in semainier.planning) {
    //     semainier.planning[day].planning.sort((a, b) => {
    //         console.log({ a, b });
    //         const timeA = extractStartTime(a.activite);
    //         const timeB = extractStartTime(b.activite);
    //         return timeA.localeCompare(timeB);
    //     });
    // }

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
            return getTimeInMinutes(a?.activite) - getTimeInMinutes(b?.activite);
        });
    }

    // Trouver le nombre maximum d'activités dans un jour
    const maxActivities = Math.max(...days.map(day => semainier.planning[day].planning.length));
    // Ajouter les activités dans le tableau
    for (let i = 0; i < maxActivities; i++) {
        const row = days.map(day => semainier.planning[day].planning[i] ? semainier.planning[day].planning[i].activite : '');
        table.push(row);
    }
    console.log(table.toString());
}

// Fonction pour supprimer une activité
async function removeActivity() {
    console.log(chalk.red('Fonctionnalité de suppression non implémentée.'));
}

// Lancer le choix de la semaine
chooseWeek().catch(err => {
    if (err.message !== 'Terminer') {
        process.exit(0);
    }
});

process.on("exit", (code) => {
    if (!globalThis.monSemainier?.hasOwnProperty("planning")) return;
    displaySemainier(globalThis.monSemainier);
});