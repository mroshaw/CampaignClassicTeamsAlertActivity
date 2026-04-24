/**
 * Teams Alert Acivity
 *
 * Created by: Iain Ollerenshaw
 *
 * This JavaScript underpins the "teamsAlert" custom workflow activity.
 * The core function of the activity is to send an "Alert" from a workflow to a Teams Channel
 * or Chat using the Teams 'Workflows' and 'WebHook' functionalities.
 *
 **/

// Entry point when activating the activity
function teamsAlertActivity_call() {
  try {

    processActivity();

    // Activities must end with these calls to execute
    // the appropriate transition and do a cleanup
    logInfo("teamsAlertActivity completed")
    task.postEvent(task.doneTransition());
    task.setCompleted();

    // Return 0 for success
    return 0;
  }
  // Exception must be captured to allow error handling and cleanup
  catch (e) {
    if (activity.transitions.error.enabled === true) {
      logInfo("Error: " + e);
      task.postEvent(task.errorTransition()); //enable error transition
    } else {
      // Calling logError will pause the workflow and the activity
      // will move to an Error state
      logError("Error: " + e);
    }
    task.setCompleted();
  }
}

/**
 * Teams alert callback function.
 *
 * Parameters:
 *
 * None
 *
 * Returns:
 *
 * Integer - 0 for success, otherwise fail
 **/
function teamsAlertActivity_recall() {
  // logInfo("teamsAlertActivity_recall");
}

/**
 * Looks at the parameters configured in the activity and processes
 * the request appropriately.
 *
 * Parameters:
 *
 * None
 *
 * Returns:
 *
 * Nothing
 **/
function processActivity() {

  try {
    // Get the activity properties
    // var webHookUrl = activity.webHookUrl;
    var webHookUrlOptionName = activity.webHookUrlOptionName;
    var cardStyle = activity.cardStyle;
    var cardWidth = activity.cardWidth;
    var headerColour = activity.headerColour;
    var heading = activity.heading;
    var subheading = activity.subheading;
    var alertText = activity.alertText;
    var icon = activity.icon;
    var includeTable = activity.includeTable;
    var tableStyle = activity.tableStyle;
    var tableColumnList = activity.tableColumnList;
    var tagPeople = activity.tagPeople;
    var assigneeType = activity.assigneeType;
    var operatorGroupId = activity.assignee_id;
    var operatorId = activity.operator_id;

    var debugMode = activity.enableDebug;

    // Get the WebHookURL from specified option
    if (webHookUrlOptionName == "") {
      throw new Error("WebHook Option Name cannot be blank!");
    }

    var webHookUrl = getOption(webHookUrlOptionName);

    if (debugMode) {
      showDebugInfo();
    }

    // Get tag email addresses if required
    var mentionInfo = null;

    if (tagPeople) {
      try {
        var tagOperators = assigneeType == 0 ? getAllOperatorsInGroup(operatorGroupId) : getOperatorEmail(operatorId);
        mentionInfo = buildTeamsMentions(tagOperators);
        if (debugMode) {
          logInfo("Tagging Emails: " + tagOperators);
          logInfo("MentionInfo.Text: " + mentionInfo.mentionText);
          logInfo("MentionInfo.Entities: " + JSON.stringify(mentionInfo.entities));
        }
      } catch (e) {
        throw new Error("An error occurred while constructing mentions. Have you selected a valid operator/operator group?\n" + e);
      }
    }

    // Build table data if required
    var tableElement = null;
    if (includeTable) {
      try {
        var tableData = buildTableData(tableColumnList, debugMode);
        tableElement = buildAdaptiveCardTable(tableData.columns, tableData.rows, tableStyle, debugMode);
      } catch (e) {
        throw new Error("An error occurred while constructing the table. Are you passing in a result set? Are the aliases correct?\n" + e);
      }
    }

    var jsonPayload = getAdaptiveCardPayload(cardStyle, cardWidth, headerColour, heading, icon, subheading, alertText, tableElement, mentionInfo, debugMode);

    sendTeamsAlert(webHookUrl, jsonPayload, debugMode);

  } catch (e) {
    throw (e);
  }
}

/**
 * Queries the inbound population work table and returns column definitions
 * and row data based on the tableColumnList configured on the activity.
 *
 * Parameters:
 *
 * debugMode - bool - true to debug, otherwise false
 *
 * Returns:
 *
 * Object with:
 *   columns - array of { headerName, attribAlias }
 *   rows    - array of objects keyed by attribAlias
 **/
function buildTableData(tableColumnList, debugMode) {

  // Extract column definitions from the activity's tableColumnList
  var columns = [];
  var columnNodes = tableColumnList.tableColumn;
  for each(var col in columnNodes) {
    columns.push({
      order: col.order || 0,
      headerName: col.headerName,
      attribAlias: col.attribAlias,
      relativeWidth: col.relativeWidth || 1
    });
  }

  if (columns.length === 0) {
    throw new Error("includeTable is true but no columns are defined in tableColumnList.");
  }

  columns.sort(function(a, b) {
    return a.order - b.order;
  });

  if (debugMode) {
    logInfo("buildTableData: querying schema=" + vars.targetSchema + " table=" + vars.tableName);
    logInfo("buildTableData: columns=" + JSON.stringify(columns));
  }

  // Build a queryDef against the inbound work table
  var selectNode = < select / > ;
  for each(var col in columns) {
    selectNode.appendChild( < node expr = {
        col.attribAlias
      }
      />);
    }

    var queryXml = < queryDef schema = {
      vars.targetSchema
    }
    operation = "select" > {
        selectNode
      } <
      /queryDef>;

    if (debugMode) {
      logInfo("Query XML: " + queryXml.toXMLString());
    }

    var queryDef = xtk.queryDef.create(queryXml);

    var result = queryDef.ExecuteQuery();

    // Build row array
    var rows = [];
    for each(var record in result.*) {
      var row = {};
      for each(var col in columns) {
        row[col.attribAlias] = record[col.attribAlias] || '';
      }
      rows.push(row);
    }

    if (debugMode) {
      logInfo("buildTableData: retrieved " + rows.length + " rows");
    }

    return {
      columns: columns,
      rows: rows
    };
  }

  /**
   * Builds an Adaptive Card Table element from column definitions and row data.
   *
   * Parameters:
   *
   * columns  - array of { headerName, attribAlias }
   * rows     - array of objects keyed by attribAlias
   * debugMode - bool - true to debug, otherwise false
   *
   * Returns:
   *
   * Adaptive Card Table object
   **/
  function buildAdaptiveCardTable(columns, rows, tableStyle, debugMode) {

    // Build header row
    var headerCells = columns.map(function(col) {
      return {
        "type": "TableCell",
        "items": [{
          "type": "TextBlock",
          "text": col.headerName,
          "weight": "Bolder",
          "wrap": true
        }]
      };
    });

    // Build data rows
    var dataRows = rows.map(function(row) {
      var cells = columns.map(function(col) {
        return {
          "type": "TableCell",
          "items": [{
            "type": "TextBlock",
            "text": String(row[col.attribAlias] || ''),
            "wrap": true
          }]
        };
      });
      return {
        "type": "TableRow",
        "cells": cells
      };
    });

    var tableElement = {
      "type": "Table",
      "firstRowAsHeaders": true,
      "style": tableStyle,
      "columns": columns.map(function(col) {
        return {
          "width": col.relativeWidth
        };
      }),
      "rows": [{
        "type": "TableRow",
        "cells": headerCells,
      }].concat(dataRows),
      "spacing": "Medium"
    };

    if (debugMode) {
      logInfo("buildAdaptiveCardTable: table element built with " + columns.length + " columns and " + rows.length + " data rows");
    }

    return tableElement;
  }

  /**
   * Builds tagging/mentions JSON for tagging the list of users
   *
   * Parameters:
   *
   * tagOperators  - array of email addresses
   *
   * Returns:
   *
   * Mentions object
   **/
  function buildTeamsMentions(tagOperators) {
    var mentions = [];
    var mentionTextFragments = [];

    for each(tagOperator in tagOperators) {
      var email = String(tagOperator.email);
      var displayName = stripDiacritics(String(tagOperator.name));

      var atText = "<at>" + displayName + "</at>";

      mentionTextFragments.push(atText);

      mentions.push({
        "type": "mention",
        "text": atText,
        "mentioned": {
          "id": email, // UPN works fine
          "name": displayName
        }
      });
    }

    return {
      mentionText: mentionTextFragments.join(" "),
      entities: mentions
    };
  }

  /**
   * Generates the JSON payload for a 'AdaptiveCard' type alert
   *
   * Parameters:
   *
   * webHookUrl -  the public URL exposed by the WebHook for the channel
   * type - the type of message to send (i.e. MessageCard)
   * theme - the theme colour as hex code
   * summary - the summary header
   * title - the post title text
   * text - the post body text
   * debugMode - bool - true to debug, otherwise false
   *
   * Returns:
   *
   * JSON payload string
   *
   **/
  function getAdaptiveCardPayload(cardStyle, cardWidth, headerColour, heading, icon, subheading, alertText, tableElement, mentionInfo, debugMode) {

    var items = [{
        "type": "ColumnSet",
        "columns": [{
            "type": "Column",
            "items": [{
              "type": "Icon",
              "name": icon,
              "style": "Filled",
              "color": headerColour
            }],
            "width": "auto",
          },
          {
            "type": "Column",
            "width": "auto",
            "items": [{
              "type": "TextBlock",
              "text": heading,
              "wrap": true,
              "style": "heading",
              "color": headerColour,
              "size": "ExtraLarge"
            }]
          }
        ],
      },
      {
        "type": "TextBlock",
        "text": subheading,
        "wrap": true,
        "spacing": "None",
        "color": headerColour,
        "weight": "Lighter",
      },
      {
        "type": "TextBlock",
        "text": alertText,
        "color": "Default",
        "wrap": true
      }
    ];

    if (tableElement !== null) {
      items.push({
        "type": "Container",
        "items": [tableElement]
      });
    }


    if (mentionInfo) {
      items.push({
        "type": "TextBlock",
        "text": "FYI " + String(mentionInfo.mentionText),
        "wrap": true,
        "weight": "Bolder",
        "spacing": "Medium"
      });
    }

    var payload = {
      "type": "message",
      "attachments": [{
        "contentType": "application/vnd.microsoft.card.adaptive",
        "content": {
          "$schema": "http://adaptivecards.io/schemas/adaptive-card.json",
          "type": "AdaptiveCard",
          "version": "1.5",
          "msteams": {
            "width": cardWidth,
            "entities": mentionInfo ? mentionInfo.entities : []
          },
          "body": [{
            "type": "Container",
            "style": cardStyle,
            "showBorder": true,
            "roundedCorners": true,
            "items": items
          }],
          "speak": alertText
        }
      }]
    };

    return payload;
  }

  /**
   * Sends a payload to an MC Teams WebHook end point
   *
   * Parameters:
   *
   * webHookUrl -  the public URL exposed by the WebHook for the channel
   * payload - the JSON payload
   * debugMode - bool - true to debug, otherwise false
   *
   * Returns:
   *
   * Nothing
   *
   **/
  function sendTeamsAlert(webHookUrl, payload, debugMode) {

    logInfo("Sending Teams alert...");

    // Serialize JSON
    var requestBody = JSON.stringify(payload);

    if (debugMode) {
      logInfo("Payload JSON: " + requestBody);
    }

    // Prepare HTTP request
    var request = new HttpClientRequest(webHookUrl);
    request.method = "POST";
    request.header["Content-Type"] = "application/json";
    request.body = requestBody;

    // Execute POST
    request.execute();

    // Read response from request object
    var statusCode = request.response.code;
    var responseBody = request.response.body;

    request.disconnect();


    // Log outcome
    if (debugMode) {
      logInfo("Teams webhook HTTP status: " + statusCode);
      logInfo("Teams webhook response body: " + responseBody);
    }

    // check for non-HTTP 200/202 response and throw an exception
    if (statusCode != 200 && statusCode != 202) {
      throw new Error("Teams webhook call failed: " + responseBody);
    } else {
      logInfo("Teams alert sent successfully!");
    }
  }

  /**
   * Queries for the operator ID and returns the email address
   *
   * Parameters:
   *
   * operatorId - primary key of the operator
   *
   * Returns:
   *
   * emailAddress as an array of name,email string pairs
   **/
  function getOperatorEmail(operatorId, debugMode) {
    var queryXml = < queryDef schema = "xtk:operator"
    operation = "getIfExists" >
      <
      select >
      <
      node expr = '[@id]' / >
      <
      node expr = '[@label]' / >
      <
      node expr = '[@email]' / >
      <
      /select> <
    where >
      <
      condition expr = {
        "[@id]='" + operatorId + "'"
      }
    /> < /
    where > <
      /queryDef>;

    if (debugMode) {
      logInfo("Query XML: " + queryXml.toXMLString());
    }

    var queryDef = xtk.queryDef.create(queryXml);
    var result = queryDef.ExecuteQuery();

    if (result.@id.length() > 0) {
      logInfo("Found!");
      return [{
        name: String(result.@label),
        email: String(result.@email)
      }];
    } else {
      logInfo("Not Found!");
      return [];
    }
  }

  /**
   * Queries for the operator group ID and returns all the operator
   * email addresses as an array
   *
   * Parameters:
   *
   * operatorGroupId - primary key of the operator group
   *
   * Returns:
   *
   * emailAddressArray as an array of name,email string pairs
   **/
  function getAllOperatorsInGroup(operatorGroupId, debugMode) {
    var queryXml = < queryDef schema = "xtk:operatorGroup"
    operation = "select" >
      <
      select >
      <
      node expr = '[@group-id]' / >
      <
      node expr = '[@operator-id]' / >
      <
      node expr = '[operator/@label]' / >
      <
      node expr = '[operator/@email]' / >
      <
      /select> <
    where >
      <
      condition expr = {
        "[@group-id]='" + operatorGroupId + "'"
      }
    /> < /
    where > <
      /queryDef>;

    if (debugMode) {
      logInfo("Query XML: " + queryXml.toXMLString());
    }

    var queryDef = xtk.queryDef.create(queryXml);
    var result = queryDef.ExecuteQuery();

    var operators = [];

    for each(operatorGroup in result) {
      if (operatorGroup.operator.@email != "") {
        operators.push({
          name: String(operatorGroup.operator.@label),
          email: String(operatorGroup.operator.@email)
        });
      }
    }

    return operators;
  }

  /**
   * Swaps out diacritic characters so the Mentions can match up
   * for user names containing such characters
   *
   * Parameters:
   *
   * originalString - Original text string
   *
   * Returns:
   *
   * result as a new string with replacements
   **/
  function stripDiacritics(originalString) {
    var map = {
      "Á": "A",
      "À": "A",
      "Â": "A",
      "Ä": "A",
      "Ã": "A",
      "Å": "A",
      "Ā": "A",
      "á": "a",
      "à": "a",
      "â": "a",
      "ä": "a",
      "ã": "a",
      "å": "a",
      "ā": "a",
      "É": "E",
      "È": "E",
      "Ê": "E",
      "Ë": "E",
      "Ē": "E",
      "é": "e",
      "è": "e",
      "ê": "e",
      "ë": "e",
      "ē": "e",
      "Í": "I",
      "Ì": "I",
      "Î": "I",
      "Ï": "I",
      "Ī": "I",
      "í": "i",
      "ì": "i",
      "î": "i",
      "ï": "i",
      "ī": "i",
      "Ó": "O",
      "Ò": "O",
      "Ô": "O",
      "Ö": "O",
      "Õ": "O",
      "Ō": "O",
      "ó": "o",
      "ò": "o",
      "ô": "o",
      "ö": "o",
      "õ": "o",
      "ō": "o",
      "Ú": "U",
      "Ù": "U",
      "Û": "U",
      "Ü": "U",
      "Ū": "U",
      "ú": "u",
      "ù": "u",
      "û": "u",
      "ü": "u",
      "ū": "u",
      "Ñ": "N",
      "ñ": "n",
      "Ç": "C",
      "ç": "c",
      "Ý": "Y",
      "Ÿ": "Y",
      "ý": "y",
      "ÿ": "y"
    };

    var result = "";
    for (var i = 0; i < originalString.length; i++) {
      var ch = originalString.charAt(i);
      result += map[ch] || ch;
    }

    return result;
  }

  /**
   * Logs all activity parameters using logInfo
   *
   * Parameters:
   *
   * None
   *
   * Returns:
   *
   * Nothing
   **/
  function showDebugInfo() {
    logInfo("***** DEBUGGING ENABLED. DEBUG PARAMETER LIST: *****");

    logInfo("WebHook Option: " + activity.webHookUrlOptionName);
    logInfo("Card Style: " + activity.cardStyle);
    logInfo("Card Width: " + activity.cardWidth);
    logInfo("Header Colour: " + activity.headerColour);
    logInfo("Icon: " + activity.icon);
    logInfo("Header Text: " + activity.heading);
    logInfo("Subheader Text: " + activity.subheading);
    logInfo("Alert Text: " + activity.alertText);
    logInfo("Include Table: " + activity.includeTable);
    logInfo("Table Style: " + activity.tableStyle);
    logInfo("Table Column List: " + activity.tableColumnList);

    logInfo("Tag People: " + activity.tagPeople);
    logInfo("Assignee Type: " + activity.assigneeType);
    logInfo("Assignee: " + activity.assignee_id);
    logInfo("Operator: " + activity.operator_id);

    logInfo("***** END OF DEBUG PARAMETER LIST *****");
  }