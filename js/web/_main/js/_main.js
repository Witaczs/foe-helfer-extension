/*
 * **************************************************************************************
 *
 * Dateiname:                 _main.js
 * Projekt:                   foe-chrome
 *
 * erstellt von:              Daniel Siekiera <daniel.siekiera@gmail.com>
 * erstellt am:	              22.12.19, 14:31 Uhr
 * zuletzt bearbeitet:       22.12.19, 13:49 Uhr
 *
 * Copyright © 2019
 *
 * **************************************************************************************
 */

let ApiURL = 'https://api.foe-rechner.de/',
    ActiveMap = 'main',
    ExtPlayerID = 0,
    ExtGuildID = 0,
    ExtWorld = '',
    CurrentEraID = null,
    BuildingNamesi18n = false,
	CityMapData = null,
    Conversations = [],
    GoodsData = [],
    GoodsList = [],
    ResourceStock = [],
    MainMenuLoaded = false,
	LGCurrentLevelMedals = undefined,
	IsLevelScroll = false,
	UsePartCalcOnAllLGs = false;

document.addEventListener("DOMContentLoaded", function(){

	// aktuelle Welt notieren
	ExtWorld = window.location.hostname.split('.')[0];
	localStorage.setItem('current_world', ExtWorld);

	// Local-Storage leeren
	localStorage.removeItem('OwnCurrentBuildingCity');
    localStorage.removeItem('OwnCurrentBuildingGreat');
});

const FoEproxy = (function () {

	const proxyMap = {};
	const proxyMetaMap = {};
	let proxyRaw = [];
	
	const proxy = {
		// for requests game/json?...
		addHandler: function(service, method, callback) {
			// default service and method to 'all'
			if (method === undefined) {
				callback = service;
				service = method = 'all';
			} else if (callback === undefined) {
				callback = method;
				method = 'all';
			}
			
			let map = proxyMap[service];
			if (!map) {
				proxyMap[service] = map = {};
			}
			let list = map[method];
			if (!list) {
				map[method] = list = [];
			}
			if (list.indexOf(callback) !== -1) {
				// already registered
				return;
			}
			list.push(callback);
		},

		removeHandler: function(service, method, callback) {
			// default service and method to 'all'
			if (method === undefined) {
				callback = service;
				service = method = 'all';
			} else if (callback === undefined) {
				callback = method;
				method = 'all';
			}
			
			let map = proxyMap[service];
			if (!map) {
				return;
			}
			let list = map[method];
			if (!list) {
				return;
			}
			map[method] = list.filter(c => c !== callback);
		},

		// for metadata requests: metadata?id=<meta>-<hash>
		addMetaHandler: function(meta, callback) {
			let list = proxyMetaMap[meta];
			if (!list) {
				proxyMetaMap[meta] = list = [];
			}
			if (list.indexOf(callback) !== -1) {
				// already registered
				return;
			}
			
			list.push(callback);
		},

		removeMetaHandler: function(meta, callback) {
			let list = proxyMetaMap[meta];
			if (!list) {
				return;
			}
			proxyMetaMap[meta] = list.filter(c => c !== callback);
		},

		// for raw requests access
		addRawHandler: function(callback) {
			if (proxyRaw.indexOf(callback) !== -1) {
				// already registered
				return;
			}
			
			proxyRaw.push(callback);
		},

		removeRawHandler: function(callback) {
			proxyRaw = proxyRaw.filter(c => c !== callback);
		}
	};
	
	/**
	 * This function gets the callbacks from proxyMap[service][method] and executes them.
	 */
	function _proxyAction(service, method, data, postData) {
		const map = proxyMap[service];
		if (!map) {
			return;
		}
		const list = map[method];
		if (!list) {
			return;
		}
		for (let callback of list) {
			try {
				callback(data, postData);
			} catch (e) {
				console.error(e);
			}
		}
	}

	/**
	 * This function gets the callbacks from proxyMap[service][method],proxyMap[service]['all'] and proxyMap['all']['all'] and executes them.
	 */
	function proxyAction(service, method, data, postData) {
		_proxyAction(service, method, data, postData);
		_proxyAction('all', method, data, postData);
		_proxyAction(service, 'all', data, postData);
		_proxyAction('all', 'all', data, postData);
	}

	const XHR = XMLHttpRequest.prototype,
		open = XHR.open,
		send = XHR.send;

	XHR.open = function(method, url){
		this._method = method;
		this._url = url;
		return open.apply(this, arguments);
	};
	
	function onLoadHandler() {
		const url = this._url;
		const postData = this._postData;
		
		// handle raw request handlers
		for (let callback of proxyRaw) {
			try {
				callback(this, postData);
			} catch (e) {
				console.error(e);
			}
		}
		
		// handle metadata request handlers
		const metadataIndex = url.indexOf("metadata?id=");
		if (metadataIndex > -1) {
			const metaURLend = metadataIndex + "metadata?id=".length,
				meta = url.substring(metaURLend).split('-', 1)[0];
			const metaHandler = proxyMetaMap[meta];
			
			if (metaHandler) {
				for (let callback of metaHandler) {
					try {
						callback(this, postData);
					} catch (e) {
						console.error(e);
					}
				}
			}
		}
		
		// nur die jSON mit den Daten abfangen
		if (url.indexOf("game/json?h=") > -1) {

			let d = JSON.parse(this.responseText);
			for (let entry of d) {
				proxyAction(entry.requestClass, entry.requestMethod, entry, postData);
			}
		}
	}

	XHR.send = function(postData){
		this._postData = postData;
		
		this.addEventListener('load', onLoadHandler);

		return send.apply(this, arguments);
	};
	return proxy;
})();

(function () {
	
	// die Gebäudenamen übernehmen
	FoEproxy.addMetaHandler('city_entities', (xhr, postData) => {
		BuildingNamesi18n = [];

		let j = JSON.parse(xhr.responseText);

		sessionStorage.setItem('BuildingsData', JSON.stringify(j));

				for (let i in j)
				{
					if (j.hasOwnProperty(i))
					{
						BuildingNamesi18n[j[i]['asset_id']] = {
							name: j[i]['name'],
							width: j[i]['width'],
							height: j[i]['length'],
							type: j[i]['type'],
							provided_happiness: j[i]['provided_happiness'],
							population: undefined,
							entity_levels : j[i]['entity_levels'],
						};

				if(j[i]['abilities'] !== undefined)
				{
					for(let x in j[i]['abilities'])
					{
						if (j[i]['abilities'].hasOwnProperty(x))
						{
							let ar = j[i]['abilities'][x];

							if(ar['additionalResources'] !== undefined && ar['additionalResources']['AllAge'] !== undefined && ar['additionalResources']['AllAge']['resources'] !== undefined)
							{
								BuildingNamesi18n[j[i]['asset_id']]['additionalResources'] = ar['additionalResources']['AllAge']['resources'];
							}
						}
					}
				}

				if (j[i]['staticResources'] !== undefined && j[i]['staticResources']['resources'] !== undefined) {
					BuildingNamesi18n[j[i]['asset_id']]['population'] = j[i]['staticResources']['resources']['population'];
				}
			}
		}

		MainParser.Buildings = BuildingNamesi18n;
	});
	
	// Technologien
	FoEproxy.addMetaHandler('research', (xhr, postData) => {
		Technologies.AllTechnologies = JSON.parse(xhr.responseText);
		$('#Tech').removeClass('hud-btn-red');
		$('#Tech-closed').remove();
	});

	// Armee Typen
	FoEproxy.addMetaHandler('unit_types', (xhr, postData) => {
		Unit.Types = JSON.parse(xhr.responseText);
	});

	// Portrait-Mapping für Spiler Avatare
	FoEproxy.addRawHandler((xhr, postData) => {
		if(xhr._url.startsWith("https://foede.innogamescdn.com/assets/shared/avatars/Portraits.xml")) {
			let portraits = {};

			$(xhr.responseText).find('portrait').each(function(){
				portraits[$(this).attr('name')] = $(this).attr('src');
			});

			MainParser.PlayerPortraits = portraits;
		}
	});

	// --------------------------------------------------------------------------------------------------
	// Player- und Gilden-ID setzen
	FoEproxy.addHandler('StartupService', 'getData', (data, postData) => {
		// Player-ID, Gilden-ID und Name setzten
		MainParser.StartUp(data.responseData.user_data);

		// andere Gildenmitglieder, Nachbarn und Freunde
		MainParser.SocialbarList(data.responseData.socialbar_list);

		// eigene Daten, Maximal alle 6h updaten
		MainParser.SelfPlayer(data.responseData.user_data);

		// Alle Gebäude sichern
		MainParser.SaveBuildings(data.responseData.city_map.entities);

		// Güterliste
		GoodsList = data.responseData.goodsList;
	});
	
	// --------------------------------------------------------------------------------------------------
	// Bonus notieren, enthält tägliche Rathaus FP
	FoEproxy.addHandler('BonusService', 'getBonuses', (data, postData) => {
		MainParser.BonusService = data.responseData;
	});

	// --------------------------------------------------------------------------------------------------
	// Botschafter notieren, enthält Bonus FPs oder Münzen
	FoEproxy.addHandler('EmissaryService', 'getAssigned', (data, postData) => {
		MainParser.EmissaryService = data.responseData;
	});

	// --------------------------------------------------------------------------------------------------
	// Boosts zusammen tragen
	FoEproxy.addHandler('BoostService', 'getAllBoosts', (data, postData) => {
		MainParser.CollectBoosts(data.responseData);
	});


	// --------------------------------------------------------------------------------------------------
	// Karte wird gewechselt zum Außenposten
	FoEproxy.addHandler('CityMapService', 'getCityMap', (data, postData) => {
		ActiveMap = data.responseData.gridId;
	});


	// Stadt wird wieder aufgerufen
	FoEproxy.addHandler('CityMapService', 'getEntities', (data, postData) => {
		if (ActiveMap === 'cultural_outpost') {
			ActiveMap = 'main';
		}

		// ErnteBox beim zurückkehren in die Stadt schliessen
		$('#ResultBox').fadeToggle(function () {
			$(this).remove();
		});

		$('#city-map-overlay').fadeToggle(function () {
			$(this).remove();
		});
	});



	// --------------------------------------------------------------------------------------------------
	// Übersetzungen der Güter
	FoEproxy.addHandler('ResourceService', 'getResourceDefinitions', (data, postData) => {
		MainParser.setGoodsData(data.responseData);
	});


	// --------------------------------------------------------------------------------------------------
	// Letzten Alca Auswurf tracken
	FoEproxy.addHandler('CityProductionService', 'pickupProduction', (data, postData) => {
		if (data.responseData.militaryProducts === undefined) {
			return;
		}
		localStorage.setItem('LastAlcatrazUnits', JSON.stringify(data.responseData.militaryProducts));
	});


	// --------------------------------------------------------------------------------------------------
	// Armee Update
	FoEproxy.addHandler('ArmyUnitManagementService', 'getArmyInfo', (data, postData) => {
		Unit.Cache = data.responseData;

		if ($('#unitBtn').hasClass('hud-btn-red')) {
			$('#unitBtn').removeClass('hud-btn-red');
			$('#unit-closed').remove();
		}

		if ($('#units').length > 0) {
			Unit.BuildBox();
		}
	});

	// --------------------------------------------------------------------------------------------------
	// Noch Verfügbare FP aktualisieren

	FoEproxy.addHandler('GreatBuildingsService', 'getAvailablePackageForgePoints', (data, postData) => {
		StrategyPoints.ForgePointBar(data.responseData[0]);
	});


	FoEproxy.addHandler('GreatBuildingsService', 'getConstruction', (data, postData) => {
		StrategyPoints.ForgePointBar(data.responseData.availablePackagesForgePointSum);
	});


	FoEproxy.addHandler('InventoryService', 'getItems', (data, postData) => {
		StrategyPoints.GetFromInventory(data.responseData);
	});

	FoEproxy.addHandler('InventoryService', 'getInventory', (data, postData) => {
		StrategyPoints.GetFromInventory(data.responseData.inventoryItems);
	});

	// --------------------------------------------------------------------------------------------------
	// --------------------------------------------------------------------------------------------------
	// Es wurde das LG eines Mitspielers angeklickt, bzw davor die Übersicht

	// Übersicht der LGs eines Nachbarn
	let LastKostenrechnerOpenTime = 0;
	FoEproxy.addHandler('GreatBuildingsService', 'getOtherPlayerOverview', (data, postData) => {
		if (data.responseData[0].player.player_id === ExtPlayerID || !Settings.GetSetting('PreScanLGList')) {
			return;
		}
		sessionStorage.setItem('OtherActiveBuildingOverview', JSON.stringify(data.responseData));
		sessionStorage.setItem('DetailViewIsNewer', false);

		$('#calcFPs').removeClass('hud-btn-red');
		$('#calcFPs-closed').remove();

		// wenn schon offen, den Inhalt updaten
		if ($('#LGOverviewBox').is(':visible')) {
			let CurrentTime = new Date().getTime()
			if (CurrentTime < LastKostenrechnerOpenTime + 1000)
				Calculator.ShowOverview(true);
			else
				Calculator.ShowOverview(false);
		}
	});

	// es wird ein LG eines Spielers geöffnet
	
	// lgUpdateData sammelt die informationen aus mehreren Handlern
	let lgUpdateData = null;
	
	FoEproxy.addHandler('GreatBuildingsService', (data, postData) => {
		let getConstruction = data.requestMethod === 'getConstruction' ? data : null;
		let getConstructionRanking = data.requestMethod === 'getConstructionRanking' ? data : null;
		let contributeForgePoints = data.requestMethod === 'contributeForgePoints' ? data : null;

		let Rankings;
		if (getConstruction != null) {
			Rankings = getConstruction.responseData.rankings;
			IsLevelScroll = false;
		}
		else if (getConstructionRanking != null) {
			Rankings = getConstructionRanking.responseData;
			IsLevelScroll = true;
		}
		else if (contributeForgePoints != null) {
			Rankings = contributeForgePoints.responseData;
			IsLevelScroll = false;
		}
		
		if (Rankings) {
			if (!lgUpdateData || !lgUpdateData.UpdateEntity) {
				lgUpdateData = {Rankings: Rankings, UpdateEntity: null};
				// reset lgUpdateData sobald wie möglich (nachdem alle einzelnen Handler ausgeführt wurden)
				Promise.resolve().then(()=>lgUpdateData = null);
			} else {
				lgUpdateData.Rankings = Rankings;
				lgUpdate();
			}
		}
	});

	FoEproxy.addHandler('CityMapService', 'updateEntity', (data, postData) => {
		if (!lgUpdateData || !lgUpdateData.Rankings) {
			lgUpdateData = {Rankings: null, UpdateEntity: data};
			// reset lgUpdateData sobald wie möglich (nachdem alle einzelnen Handler ausgeführt wurden)
			Promise.resolve().then(()=>lgUpdateData = null);
		} else {
			lgUpdateData.UpdateEntity = data;
			lgUpdate();
		}
	});
	
	// Update Funktion, die ausgeführt wird, sobald beide Informationen in lgUpdateData vorhanden sind.
	function lgUpdate() {
		const {UpdateEntity, Rankings} = lgUpdateData;
		lgUpdateData = null;
		let IsPreviousLevel = false;

		//Eigenes LG
		if (UpdateEntity.responseData[0].player_id === ExtPlayerID || UsePartCalcOnAllLGs) {
			//LG Scrollaktion: Beim ersten mal Öffnen Medals von P1 notieren. Wenn gescrollt wird und P1 weniger Medals hat, dann vorheriges Level, sonst aktuelles Level
			if (IsLevelScroll) {
				let Medals = 0;
				for (let i = 0; i < Rankings.length; i++) {
					if (Rankings[i]['reward'] !== undefined) {
						Medals = Rankings[i]['reward']['resources']['medals'];
						break;
					}
				}

				if (Medals !== LGCurrentLevelMedals) {
					IsPreviousLevel = true;
				}
			}
			else {
				let Medals = 0;
				for (let i = 0; i < Rankings.length; i++) {
					if (Rankings[i]['reward'] !== undefined) {
						Medals = Rankings[i]['reward']['resources']['medals'];
						break;
					}
				}
				LGCurrentLevelMedals = Medals;
			}

			localStorage.setItem('OwnCurrentBuildingCity', JSON.stringify(UpdateEntity.responseData[0]));
			localStorage.setItem('OwnCurrentBuildingGreat', JSON.stringify(Rankings));
			localStorage.setItem('OwnCurrentBuildingPreviousLevel', IsPreviousLevel);

			// das erste LG wurde geladen
			$('#ownFPs').removeClass('hud-btn-red');
			$('#ownFPs-closed').remove();

			if ($('#OwnPartBox').length > 0) {
				Parts.RefreshData();
			}

			if (!IsLevelScroll) {
				MainParser.OwnLG(UpdateEntity.responseData[0], Rankings);
			}
		}

		//Fremdes LG
		if (UpdateEntity.responseData[0].player_id !== ExtPlayerID && !IsPreviousLevel) {
			LastKostenrechnerOpenTime = new Date().getTime()

			$('#calcFPs').removeClass('hud-btn-red');
			$('#calcFPs-closed').remove();

			sessionStorage.setItem('OtherActiveBuilding', JSON.stringify(Rankings));
			sessionStorage.setItem('OtherActiveBuildingData', JSON.stringify(UpdateEntity['responseData'][0]));
			sessionStorage.setItem('DetailViewIsNewer', true);

			// wenn schon offen, den Inhalt updaten
			if ($('#costCalculator').is(':visible')) {
				Calculator.Show(Rankings, UpdateEntity.responseData[0]);
			}
		}

	}

	// --------------------------------------------------------------------------------------------------
	// Tavernenboost wurde gekauft
	FoEproxy.addHandler('BoostService', 'addBoost', (data, postData) => {
		Tavern.TavernBoost(data.responseData);
	});



	// --------------------------------------------------------------------------------------------------

	// Ernten anderer Spieler
	FoEproxy.addHandler('OtherPlayerService', 'visitPlayer', (data, postData) => {
		if (!Settings.GetSetting('ShowNeighborsGoods')){
			return;
		}
		let OtherPlayer = data.responseData.other_player;
		if (OtherPlayer.is_neighbor && !OtherPlayer.is_friend && !OtherPlayer.is_guild_member) {
			Reader.OtherPlayersBuildings(data.responseData);
		}
	});
	
	
	// --------------------------------------------------------------------------------------------------
	// Verarbeiter für Außenposten daten:
	
	// Alle Typen der Außenposten "notieren"
	FoEproxy.addHandler('OutpostService', 'getAll', (data, postData) => {
		if (!Settings.GetSetting('ShowOutpost')) {
			return;
		}
		Outposts.GetAll(data.responseData);
	});

	// Gebäude des Außenpostens sichern
	FoEproxy.addHandler('AdvancementService', 'getAll', (data, postData) => {
		if (!Settings.GetSetting('ShowOutpost')) {
			return;
		}
		Outposts.SaveBuildings(data.responseData);
	});

	// Güter des Spielers ermitteln
	FoEproxy.addHandler('ResourceService', 'getPlayerResources', (data, postData) => {
		ResourceStock = data.responseData.resources; //Lagerbestand immer aktulisieren. Betrifft auch andere Module wie Technologies oder Negotiation
		if (Settings.GetSetting('ShowOutpost')) {
			Outposts.CollectResources();
		}
	});


	// Verarbeite Daten die an foe-rechner.de geschickt werden können
	
	// eigene LG Daten speichern
	FoEproxy.addHandler('InventoryService', 'getGreatBuildings', (data, postData) => {
		if (!Settings.GetSetting('GlobalSend')) {
			return;
		}
		MainParser.SaveLGInventory(data.responseData);
	});

	//--------------------------------------------------------------------------------------------------
	//--------------------------------------------------------------------------------------------------


	// Liste der Gildenmitglieder
	FoEproxy.addHandler('OtherPlayerService', 'getClanMemberList', (data, postData) => {
		if (!Settings.GetSetting('GlobalSend')) {
			return;
		}
		MainParser.SocialbarList(data.responseData);
	});

	//--------------------------------------------------------------------------------------------------
	//--------------------------------------------------------------------------------------------------


	// LGs des eigenen Clans auslesen
	FoEproxy.addHandler('OtherPlayerService', 'visitPlayer', (data, postData) => {
		if (!Settings.GetSetting('GlobalSend') || !Settings.GetSetting('SendGildMemberLGInfo')) {
			return;
		}
		if (data.responseData.other_player.clan_id !== ExtGuildID){
			return;
		}
		MainParser.OtherPlayersLGs(data.responseData);
	});

	//--------------------------------------------------------------------------------------------------
	//--------------------------------------------------------------------------------------------------


	// Gildenmitglieder in der GEX (Fortschritt, Plazierung usw.)
	FoEproxy.addHandler('GuildExpeditionService', 'getContributionList', (data, postData) => {
		if (!Settings.GetSetting('GlobalSend') || !Settings.GetSetting('SendGEXInfo')) {
			return;
		}
		if (MainParser.checkNextUpdate('GuildExpedition') !== true) {
			return;
		}
		MainParser.GuildExpedition(GEXList['responseData']);
	});

	//--------------------------------------------------------------------------------------------------
	//--------------------------------------------------------------------------------------------------


	// Gildenplatzierung in der GEX
	FoEproxy.addHandler('ChampionshipService', 'getOverview', (data, postData) => {
		if (!Settings.GetSetting('GlobalSend') || !Settings.GetSetting('SendGEXInfo')) {
			return;
		}
		if (MainParser.checkNextUpdate('Championship') !== true){
			return;
		}
		MainParser.Championship(data.responseData);
	});


	// LG Investitionen
	FoEproxy.addHandler('GreatBuildingsService', 'getContributions', (data, postData) => {
		if (!Settings.GetSetting('GlobalSend') || !Settings.GetSetting('SendInvestigations')) {
			return;
		}
		if (MainParser.checkNextUpdate('GreatBuildings') !== true) {
			return;
		}
		MainParser.GreatBuildings(data.responseData);
	});

	//--------------------------------------------------------------------------------------------------
	//--------------------------------------------------------------------------------------------------


	// LG Freundesliste
	FoEproxy.addHandler('OtherPlayerService', 'getFriendsList', (data, postData) => {
		if (!Settings.GetSetting('GlobalSend')) {
			return;
		}
		MainParser.FriendsList(data.responseData);
	});

	//--------------------------------------------------------------------------------------------------
	//--------------------------------------------------------------------------------------------------


	// Moppel Aktivitäten
	FoEproxy.addHandler('OtherPlayerService', 'getEventsPaginated', (data, postData) => {
		if (!Settings.GetSetting('GlobalSend') || !Settings.GetSetting('SendTavernInfo')) {
			return;
		}
		let page = data.responseData.page,
			time = MainParser.checkNextUpdate('OtherPlayersMotivation-' + page);

		if(time === true){
			MainParser.OtherPlayersMotivation(data.responseData);
		}
	});
	
	// ende der Verarbeiter von data für foe-rechner.de



	FoEproxy.addHandler('TimeService', 'updateTime', (data, postData) => {
		// erste Runde
		if(MainMenuLoaded === false){
			MainMenuLoaded = data.responseData.time;
		}
		// zweite Runde
		else if (MainMenuLoaded !== false && MainMenuLoaded !== true){
			_menu.BuildOverlayMenu();
			MainMenuLoaded = true;

			MainParser.setLanguage();
		}
	});

	// --------------------------------------------------------------------------------------------------
	// Technologien

	FoEproxy.addHandler('ResearchService', 'getProgress', (data, postData) => {
		Technologies.UnlockedTechologies = data.responseData;
	});
	
	// --------------------------------------------------------------------------------------------------
	// KampagneMap Service
	FoEproxy.addHandler('CampaignService', 'getProvinceData', (data, postData) => {
		KampagneMap.AllProvinces = JSON.parse(localStorage.getItem('AllProvinces'));

		KampagneMap.Provinces = data.responseData;
		if($('#Map').hasClass('hud-btn-red')){
			$('#Map').removeClass('hud-btn-red');
			$('#map-closed').remove();
		}
		if ($('#campagne').length > 0) {
			KampagneMap.BuildBox();
		}
	});

	FoEproxy.addHandler('CampaignService', 'start', (data, postData) => {
		localStorage.setItem('AllProvinces', JSON.stringify(data.responseData.provinces));
	});

	// --------------------------------------------------------------------------------------------------
	// Negotiation

	FoEproxy.addHandler('all', 'startNegotiation', (data, postData) => {
		Negotiation.StartNegotiation(data.responseData);
	});

	FoEproxy.addHandler('NegotiationGameService', 'submitTurn', (data, postData) => {
		Negotiation.SubmitTurn(data.responseData);
	});

	FoEproxy.addHandler('NegotiationGameService', 'giveUp', (data, postData) => {
		Negotiation.ExitNegotiation(data.responseData);
	});
})();


/**
 *
 * @type {{BoostMapper: {supplies_boost: string, happiness: string, money_boost: string, military_boost: string}, SelfPlayer: MainParser.SelfPlayer, showInfo: MainParser.showInfo, FriendsList: MainParser.FriendsList, CollectBoosts: MainParser.CollectBoosts, setGoodsData: MainParser.setGoodsData, GreatBuildings: MainParser.GreatBuildings, SaveLGInventory: MainParser.SaveLGInventory, SaveBuildings: MainParser.SaveBuildings, checkNextUpdate: (function(*=): string|boolean), Language: string, BonusService: null, apiCall: MainParser.apiCall, OtherPlayersMotivation: MainParser.OtherPlayersMotivation, setConversations: MainParser.setConversations, StartUp: MainParser.StartUp, OtherPlayersLGs: MainParser.OtherPlayersLGs, AllBoosts: {supply_production: number, coin_production: number, def_boost_defender: number, att_boost_attacker: number, happiness_amount: number}, GuildExpedition: MainParser.GuildExpedition, Buildings: null, PossibleLanguages: [string, string, string, string], PlayerPortraits: null, i18n: null, getAddedDateTime: (function(*=, *=): number), getCurrentDateTime: (function(): number), OwnLG: MainParser.OwnLG, loadJSON: MainParser.loadJSON, SocialbarList: MainParser.SocialbarList, Championship: MainParser.Championship, loadFile: MainParser.loadFile, send2Server: MainParser.send2Server, compareTime: MainParser.compareTime, EmissaryService: null, setLanguage: MainParser.setLanguage}}
 */
let MainParser = {

	Language: 'en',
	Buildings: null,
	i18n: null,
	PossibleLanguages: [
		'de', 'en', 'fr','es'
	],
	BonusService: null,
	EmissaryService: null,
	PlayerPortraits: null,

	BoostMapper: {
		'supplies_boost': 'supply_production',
		'happiness' : 'happiness_amount',
		'military_boost' : 'att_boost_attacker',
		'money_boost' : 'coin_production'
	},


	/**
	 * Speichert alle aktiven Boosts
	 */
	AllBoosts: {
		'def_boost_defender': 0,
		'happiness_amount': 0,
		'att_boost_attacker': 0,
		'coin_production': 0,
		'supply_production': 0
	},


	/**
	 *
	 */
	setLanguage: ()=>{
		// Translation
		MainParser.Language = GuiLng;
	},


	/**
	 * Rechnet auf die aktuelle Zeit x Minuten oder x Stunden drauf
	 *
	 * @param hrs
	 * @param min
	 * @returns {number}
	 */
	getAddedDateTime: (hrs, min = 0)=> {

		let time = new Date().getTime(),
			h = hrs || 0,
			m = min || 0,

			// Zeit aufschlagen
			newTime = time + (1000*60*m) + (1000*60*60*h),

			// daraus neues Datumsobjekt erzeugen
			newDate = new Date(newTime);

		return newDate.getTime();
	},


	/**
	 * Gibt die aktuelle Datumszeit zurück
	 *
	 * @returns {number}
	 */
	getCurrentDateTime: ()=> {
		return new Date().getTime();
	},


	/**
	 * Der Storage hat immer schon einen Zeitaufschlag
	 *
	 * @param actual
	 * @param storage
	 * @returns {string|boolean}
	 */
	compareTime: (actual, storage)=> {

		// es gibt noch keinen Eintrag
		if(storage === null){
			return true;

		} else if(actual > storage){
			return true;

			// Zeit Differenz berechnen
		} else if(storage > actual){

			let diff = Math.abs(actual - storage),
				timeDiff = new Date(diff);

			let hh = Math.floor(timeDiff / 1000 / 60 / 60);
			if(hh < 10) {
				hh = '0' + hh;
			}
			timeDiff -= hh * 1000 * 60 * 60;

			let mm = Math.floor(timeDiff / 1000 / 60);
			if(mm < 10) {
				mm = '0' + mm;
			}
			timeDiff -= mm * 1000 * 60;

			let ss = Math.floor(timeDiff / 1000);
			if(ss < 10) {
				ss = '0' + ss;
			}

			return mm + "min und " + ss + 's';
		}
	},


	/**
	 * prüfen ob ein Update notwendig ist
	 *
	 * @param ep
	 * @returns {*}
	 */
	checkNextUpdate: (ep)=> {
		let s = localStorage.getItem(ep),
			a = MainParser.getCurrentDateTime();

		return MainParser.compareTime(a, s);
	},


	/**
	 * Daten nach "Hause" schicken
	 *
	 * @param data
	 * @param ep
	 * @param successCallback
	 */
	send2Server: (data, ep, successCallback)=> {

		let pID = ExtPlayerID,
			cW = ExtWorld,
			gID = ExtGuildID;

		$.ajax({
			type: 'POST',
			url: 'https://foe-rechner.de/import/_ajax?ajax=raw&action=' + ep + '&player_id=' + pID + '&guild_id=' + gID + '&world=' + cW,
			data: {data},
			dataType: 'json',
			success: function(r){
				if(successCallback !== undefined)
				{
					successCallback(r);
				}
			}
		});
	},


	/**
	 * Daten an foe-rechner schicken, wenn aktiviert
	 *
	 * @param data
	 * @param ep
	 * @param successCallback
	 */
	apiCall: (data, ep, successCallback)=> {

		let pID = ExtPlayerID,
			cW = ExtWorld,
			gID = ExtGuildID;

		$.ajax({
			type: 'POST',
			url: ApiURL + ep + '/?player_id=' + pID + '&guild_id=' + gID + '&world=' + cW,
			data: {data},
			dataType: 'json',
			success: function(r){
				if(successCallback !== undefined)
				{
					successCallback(r);
				}
			}
		});
	},


	/**
	 * Benachrichtigung zeigen
	 *
	 * @param title
	 * @param msg
	 * @param time
	 */
	showInfo: (title, msg, time)=> {
		let t = time === undefined ? 4000 : time;

		chrome.runtime.sendMessage(extID, {type: 'message', title: title, msg: msg, time: t});
	},


	/**
	 * Gildenmitglieder durchsteppen
	 *
	 * @param d
	 * @constructor
	 */
	SocialbarList: (d)=> {

		if(Settings.GetSetting('GlobalSend') === false)
		{
			return ;
		}

		if(MainParser.checkNextUpdate('OtherPlayers') === true)
		{
			let player = [];

			for(let k in d){
				if(d.hasOwnProperty(k)){

					// wenn die Gilden-ID eine andere ist, abbrechen
					if(ExtGuildID !== d[k]['clan_id'] || d[k]['clan_id'] === ''){
						break;
					}

					let info = {
						avatar: d[k]['avatar'],
						city_name: d[k]['city_name'],
						clan_id: d[k]['clan_id'],
						name: d[k]['name'],
						player_id: d[k]['player_id'],
						rank: d[k]['rank'],
						title: d[k]['title'],
						won_battles: d[k]['won_battles'],
						score: d[k]['score'],
						profile_text: d[k]['profile_text'],
					};

					player.push(info);
				}
			}

			// wenn es nicht leer ist, abschicken
			if(player.length > 0){
				chrome.runtime.sendMessage(extID, {
					type: 'send2Api',
					url: ApiURL + 'OtherPlayers/?player_id=' + ExtPlayerID + '&guild_id=' + ExtGuildID + '&world=' + ExtWorld,
					data: JSON.stringify(player)
				});
			}
		}
	},


	/**
	 * Eigenes LGs updaten
	 * Zeitfenster - 15min
	 *
	 * @param d
	 * @param e
	 * @returns {boolean}
	 * @constructor
	 */
	OwnLG: (d, e)=> {
        // ist es schon wieder so weit?
        let lg_name = 'LG-' + d['cityentity_id'] + '-' + ExtPlayerID,
            time = MainParser.checkNextUpdate(lg_name);

        // noch nicht wieder updaten oder es ist kein "eigenes" LG
        if (time !== true || d['player_id'] !== ExtPlayerID) {
            return false;
        }

        MainParser.send2Server(d, 'OwnLG', function (r) {

            // nach Erfolg, Zeitstempel in den LocalStorage
            if (r['status'] === 'OK') {
                localStorage.setItem(lg_name, MainParser.getAddedDateTime(0, 15));
            }
        });
	},


	/**
	 * LGs anderer Spieler updaten, aber nur Gilden eigenen
	 *
	 * @param d
	 * @returns {boolean}
	 * @constructor
	 */
	OtherPlayersLGs: (d)=> {

		// gehört nicht zur Gilde
		if(ExtGuildID !== d['other_player']['clan_id']){
			return false;
		}

		let lg = d['city_map']['entities'],
			data = [],
			player = {
				player_id: d['other_player']['player_id'],
				name: d['other_player']['name'],
				guild_id: d['other_player']['clan_id'],
			},
			lgs = [];

		data.push(player);

		for(let k in lg){

			if(!lg.hasOwnProperty(k)){
				break;
			}

			// nur wenn es eines dieser Gebäude ist
			if(lg[k]['cityentity_id'].indexOf("_Landmark") > -1 ||
				lg[k]['cityentity_id'].indexOf("X_AllAge_Expedition") > -1 ||
				lg[k]['cityentity_id'].indexOf("X_AllAge_EasterBonus4") > -1 ||
				lg[k]['cityentity_id'].indexOf("X_AllAge_Oracle") > -1
			){
				let lgd = {

					cityentity_id: lg[k]['cityentity_id'],
					level: lg[k]['level'],
					max_level: lg[k]['max_level'],
					invested_forge_points: lg[k]['state']['invested_forge_points'],
					forge_points_for_level_up: lg[k]['state']['forge_points_for_level_up']
				};

				lgs.push(lgd);
			}
		}

		if(lgs.length > 0){
			data.push({lgs: lgs});

			// ab zum Server
			chrome.runtime.sendMessage(extID, {
				type: 'send2Api',
				url: ApiURL + 'OtherPlayersLGs/?player_id=' + ExtPlayerID + '&guild_id=' + ExtGuildID + '&world=' + ExtWorld,
				data: JSON.stringify(data)
			});

			MainParser.showInfo(
				d['other_player']['name'] + ' geupdated',
				HTML.i18nReplacer(
					i18n['API']['LGGildMember'],
					{
						'player' : d['other_player']['name']
					}
				)
			);
		}
	},


	/**
	 *
	 * @param d
	 * @constructor
	 */
	GuildExpedition: (d)=> {

		// doppeltes Senden unterdrücken
		let time = MainParser.checkNextUpdate('API-GEXPlayer');

		if(time !== true){
			return;
		}

		chrome.runtime.sendMessage(extID, {
			type: 'send2Api',
			url: ApiURL + 'GEXPlayer/?player_id=' + ExtPlayerID + '&guild_id=' + ExtGuildID + '&world=' + ExtWorld,
			data: JSON.stringify(d)
		});

		MainParser.showInfo(i18n['API']['UpdateSuccess'], i18n['API']['GEXPlayer']);

		localStorage.setItem('API-GEXPlayer', MainParser.getAddedDateTime(0, 1));
	},


	/**
	 * @param d
	 * @constructor
	 */
	Championship: (d)=> {

		let data = {
				participants: d['participants'],
				ranking: d['ranking'],
			};

		chrome.runtime.sendMessage(extID, {
			type: 'send2Api',
			url: ApiURL + 'GEXChampionship/?player_id=' + ExtPlayerID + '&guild_id=' + ExtGuildID + '&world=' + ExtWorld,
			data: JSON.stringify(data)
		});

		MainParser.showInfo(i18n['API']['UpdateSuccess'], i18n['API']['GEXChampionship']);
	},


	/**
	 * Spieler Daten sichern
	 *
	 * @param d
	 * @constructor
	 */
	StartUp: (d)=> {
		ExtGuildID = d['clan_id'];
        ExtWorld = window.location.hostname.split('.')[0];
        CurrentEraID = Technologies.Eras[d['era']['era']];

		chrome.runtime.sendMessage(extID, {
			type: 'storeData',
			key: 'current_guild_id',
			data: ExtGuildID
		});
		localStorage.setItem('current_guild_id', ExtGuildID);

		ExtPlayerID = d['player_id'];
		chrome.runtime.sendMessage(extID, {
			type: 'storeData',
			key: 'current_player_id',
			data: ExtPlayerID
		});
		localStorage.setItem('current_player_id', ExtPlayerID);

		chrome.runtime.sendMessage(extID, {
			type: 'storeData',
			key: 'current_world',
			data: ExtWorld
		});
		localStorage.setItem('current_world', ExtWorld);

		chrome.runtime.sendMessage(extID, {
			type: 'storeData',
			key: 'current_player_name',
			data: d['user_name']
		});
		localStorage.setItem(ExtPlayerID+'_current_player_name', d['user_name']);

		if(devMode)
		{
			HTML.Box({
				'id': 'DevNode',
				'title': 'Hinweis!',
				'auto_close': true
			});

			setTimeout(()=>{
				let desc = 'Hey BETA-Tester!<br>Bitte immer den Cache zwischendurch leeren!<br><br>- F12 > Konsole auf<br>- Reiter "Network" > Haken bei "Disable cache"<br>- mit geöffneter Konsole neu laden';

				$('#DevNodeBody').html(desc);

			}, 200);
		}
	},


	/**
	 * Eigene Daten updaten (Gildenwechsel etc)
	 *
	 * @param d
	 * @constructor
	 */
	SelfPlayer: (d)=>{

		if(Settings.GetSetting('GlobalSend') === false)
		{
			return;
		}

		let data = {
			player_id: d['player_id'],
			user_name: d['user_name'],
			portrait_id: d['portrait_id'],
			clan_id: d['clan_id'],
		};

		// ab zum Server
		chrome.runtime.sendMessage(extID, {
			type: 'send2Api',
			url: ApiURL + 'SelfPlayer/?player_id=' + ExtPlayerID + '&guild_id=' + ExtGuildID + '&world=' + ExtWorld,
			data: JSON.stringify(data)
		});
	},


	/**
	 * LG Investitionen
	 *
	 * @param d
	 * @constructor
	 */
	GreatBuildings: (d)=>{

		chrome.runtime.sendMessage(extID, {
			type: 'send2Api',
			url: ApiURL + 'LGInvest/?player_id=' + ExtPlayerID + '&guild_id=' + ExtGuildID + '&world=' + ExtWorld,
			data: JSON.stringify(d)
		});

		MainParser.showInfo(i18n['API']['UpdateSuccess'], i18n['API']['LGInvest']);
	},


	/**
	 * Alle Gebäude sichern,
	 * Eigene LGs updaten
	 *
	 * @param d
	 * @constructor
	 */
	SaveBuildings: (d)=>{
		CityMapData = d;

		if(Settings.GetSetting('GlobalSend') === false)
		{
			return;
		}

		let lgs = [];

		for(let i in d)
		{
			if(d.hasOwnProperty(i))
			{
				if(d[i]['type'] === 'greatbuilding'){
					let b = {
						cityentity_id: d[i]['cityentity_id'],
						level: d[i]['level'],
						max_level: d[i]['max_level'],
						invested_forge_points: d[i]['state']['invested_forge_points'] || 0,
						forge_points_for_level_up: d[i]['state']['forge_points_for_level_up']
					};

					lgs.push(b);

					if(d[i]['bonus'] !== undefined && MainParser.BoostMapper[d[i]['bonus']['type']] !== undefined)
					{
						if (d[i]['bonus']['type'] !== 'happiness') { //Nicht als Boost zählen => Wird Productions extra geprüft und ausgewiesen
							MainParser.AllBoosts[MainParser.BoostMapper[d[i]['bonus']['type']]] += d[i]['bonus']['value']
						}
					}
				}
			}
		}

		if(lgs.length > 0)
		{
			// ab zum Server
			chrome.runtime.sendMessage(extID, {
				type: 'send2Api',
				url: ApiURL + 'SelfPlayerLGs/?player_id=' + ExtPlayerID + '&guild_id=' + ExtGuildID + '&world=' + ExtWorld,
				data: JSON.stringify(lgs)
			});
		}
	},


	/**
	 * Sammelt aktive Boosts der Stadt
	 *
	 * @param d
	 * @constructor
	 */
	CollectBoosts: (d)=>{
		for(let i in d)
		{
			if(d.hasOwnProperty(i))
			{
				if(MainParser.AllBoosts[d[i]['type']] !== undefined)
				{
					MainParser.AllBoosts[d[i]['type']] += d[i]['value']
				}
			}
		}
	},


	/**
	 * LGs des Spielers speichern
	 *
	 * @param d
	 * @constructor
	 */
	SaveLGInventory: (d)=>{
		chrome.runtime.sendMessage(extID, {
			type: 'send2Api',
			url: ApiURL + 'LGInventory/?player_id=' + ExtPlayerID + '&guild_id=' + ExtGuildID + '&world=' + ExtWorld,
			data: JSON.stringify(d)
		});
	},


	OtherPlayersMotivation: (d)=>{

		let page = d['page'],
			ev = d['events'],
			data = [],
			pm = [];

		data.push({page: page});

		for(let i in ev){

			if (ev.hasOwnProperty(i)) {

				if(ev[i]['type'] === 'social_interaction'){
					let pd = {
						id: ev[i]['id'],
						date: ev[i]['date'],
						entity_id: ev[i]['entity_id'] || '',
						action: ev[i]['interaction_type'] || '',
						is_friend: ev[i]['other_player']['is_friend'],
						is_guild_member: ev[i]['other_player']['is_guild_member'],
						is_neighbor: ev[i]['other_player']['is_neighbor'],
						name: ev[i]['other_player']['name'],
						player_id: ev[i]['other_player']['player_id']
					};

					pm.push(pd);

				} else if (ev[i]['type'] === 'friend_tavern_sat_down'){

					let pd = {
						id: ev[i]['id'],
						date: ev[i]['date'],
						entity_id: '',
						action: 'friend_tavern_sat_down',
						is_friend: ev[i]['other_player']['is_friend'],
						is_guild_member: ev[i]['other_player']['is_guild_member'],
						is_neighbor: ev[i]['other_player']['is_neighbor'],
						name: ev[i]['other_player']['name'],
						player_id: ev[i]['other_player']['player_id']
					};

					pm.push(pd);
				}
			}
		}

		if(pm.length > 0){
			data.push({players: pm});

			MainParser.send2Server(data, 'OtherPlayersMotivation', function(r){

				// nach Erfolg, Zeitstempel in den LocalStorage
				if(r['status'] === 'OK'){
					localStorage.setItem('OtherPlayersMotivation-' + page, MainParser.getAddedDateTime(0, 10));

					// Meldung ausgeben
					MainParser.showInfo('Spieler gefunden', r['msg'], 1600);

				} else if (r['status'] === 'NOTICE') {
					localStorage.setItem('OtherPlayersMotivation-' + page, MainParser.getAddedDateTime(1, 0));

					// Meldung ausgeben
					MainParser.showInfo('Alles aktuell!', r['msg'], 6000);
				}
			});
		}
	},


	/**
	 * Übermittelt die Freundesliste beim betreten des Spieles
	 * oder wenn nicht aktivert wenn der Tab ausgewählt wurde
	 *
	 * @param d
	 * @constructor
	 */
	FriendsList: (d)=>{
		let data = [];

		for(let i in d){
			if (!d.hasOwnProperty(i)) {
				break;
			}

			// nicht selbst mitschicken
			if(d[i]['player_id'] !== ExtPlayerID){
				let pl = {
					avatar: d[i]['avatar'],
					city_name: d[i]['city_name'],
					player_id: d[i]['player_id'],
					clan_id: d[i]['clan_id'] || '',
					name: d[i]['name'],
					score: d[i]['score'],
					rank: d[i]['rank']
				};

				data.push(pl);
			}
		}

		if(data.length > 0){
			chrome.runtime.sendMessage(extID, {
				type: 'send2Api',
				url: ApiURL + 'FriendsList/?player_id=' + ExtPlayerID + '&guild_id=' + ExtGuildID + '&world=' + ExtWorld,
				data: JSON.stringify(d)
			});
		}
	},


	/**
	 * Übersetzungen für die Güter zusammen setzen
	 *
	 * @param d
	 */
	setGoodsData: (d)=> {
		for(let i in d){
			if(d.hasOwnProperty(i)) {
				GoodsData[d[i]['id']] = d[i];
			}
		}
	},


	/**
	 * Titel der Chats sammeln
	 *
	 * @param d
	 */
	setConversations: (d)=> {

		let StorageHeader = localStorage.getItem('ConversationsHeaders');

		// wenn noch nichts drin , aber im LocalStorage vorhanden, laden
		if(Conversations.length === 0 && StorageHeader !== null){
			Conversations = JSON.parse(StorageHeader);
		}

		// GildenChat
		if(d['clanTeaser'] !== undefined && Conversations.filter((obj)=> (obj.id === d['clanTeaser']['id'])).length === 0){
			Conversations.push({
				id: d['clanTeaser']['id'],
				title: d['clanTeaser']['title']
			});
		}

		if(d['teasers'] !== undefined){
			// die anderen Chats
			for(let k in d['teasers']){

				if(d['teasers'].hasOwnProperty(k)){

					if(Conversations.filter((obj)=> (obj.id === d['teasers'][k]['id'])).length === 0){
						Conversations.push({
							id: d['teasers'][k]['id'],
							title: d['teasers'][k]['title']
						});
					}
				}
			}
		}

		if(d[0] !== undefined && d[0].length > 0){

			for(let k in d){
				if(d.hasOwnProperty(k)){
					if(Conversations.filter((obj)=> (obj.id === d[k]['id'])).length === 0){
						Conversations.push({
							id: d[k]['id'],
							title: d[k]['title']
						});
					}
				}
			}
		}

		if(Conversations.length > 0){
			localStorage.setItem('ConversationsHeaders', JSON.stringify(Conversations));
		}
	},


	/**
	 * Via Ajax eine jSON holen
	 *
	 */
	loadJSON: (url, callback)=> {

		let xobj = new XMLHttpRequest();
		xobj.overrideMimeType("application/json");
		xobj.open('GET', url, true);
		xobj.onreadystatechange = function () {
			if (xobj.readyState === 4 && xobj.status === 200) {
				callback(xobj.responseText);
			}
		};
		xobj.send(null);
	},


	loadFile: (url, callback)=> {

		let xhr = new XMLHttpRequest();
		xhr.open('GET', url, true);
		xhr.responseType = 'blob';
		xhr.onreadystatechange = function () {
			if (xhr.readyState === 4 && xhr.status === 200) {
				let reader = new FileReader();
				reader.readAsArrayBuffer(xhr.response);
				reader.onload =  function(e){
					callback(e.target.result);
				};
			} else {
				callback(false);
			}
		};
		xhr.send();

	},
};
