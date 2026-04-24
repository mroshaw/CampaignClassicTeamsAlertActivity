# Campaign Classic - Teams Alert Activity
A custom Adobe Campaign Classic workflow activity to post alerts to MS Teams channels and chats:

![](https://raw.githubusercontent.com/mroshaw/CampaignClassicTeamsAlertActivity/refs/heads/main/Documentation/Images/TeamsAlertExample.png)

# Introduction

The "Teams Alert Activity" adds a new activity that can be added to any Campaign Classic Workflow to create [AdaptiveCard](https://adaptivecards.microsoft.com/) alert posts in any authorised Teams Channel or Chat:

![](https://raw.githubusercontent.com/mroshaw/CampaignClassicTeamsAlertActivity/refs/heads/main/Documentation/Images/WorkflowExample.png)

The activity is designed to be used alongside the existing "Alert" workflow activity, providing an additional channel for notifications.

# Features

- Can be used in any workflow exactly as you would use any of the out-of-the-box activities.
- Configurable heading, subheading and alert text.
- Selection of icons to use in headers to increase visibility and impact.
- Supports card [styles](https://adaptivecards.microsoft.com/?topic=Container) and header [text colours,](https://adaptivecards.microsoft.com/?topic=TextBlock) using the standard AdaptiveCard properties.
- Choose standard or full width teams card formats.
- Optionally include a table driven by an inbound dataset.
- Optionally "Mention" an operator or operator group to increase visibility.
- Uses the latest Teams Workflows WebHooks implementation, not the deprecated WebHook Connector.

# Limitations

- Your Teams environment must support AdaptiveCards version 1.5 or above.
- Mentions depends on the use of an SSO/Azure Connector - Campaign operator email addresses/logins must be the same as Teams logins.

# User Guide

## Activity configuration

Double-click the activity to view the configuration. Configuration is split into 3 tabs:

- Teams Alert - the main content and style settings.
- Table - configure a table to be added to the alert.
- Tagging - configure “mentions” in the posted alert card.

### Activity properties

| **Parameter**        | **Description**                                              |
| -------------------- | ------------------------------------------------------------ |
| Label                | The label text of the activity as it appears in the Workflow editor. |
| Process errors       | When checked, an error transition is made available for you to handle and manage error scenarios. If unchecked, the activity will cause the workflow to pause if an error situation is encountered. |
| Debug mode           | If checked, the activity will log all parameter values and generate more detailed log output. You can view all debug output via the workflow audit. |
| WebHook Option       | The name of the “Option” that contains the Teams WebHook URL. An option is used to secure the URL, so that it can’t be used by anyone unauthorised to do so. |
| Card Style           | Determines the colour accent of the published card. Styles represent colour themes that are defined in Teams itself, hence the non-specific naming. Examples can be found in the [AdaptiveCard Container documentation](https://adaptivecards.microsoft.com/?topic=Container). |
| Header Colour        | The colour accent to apply to the header, subheader and icon. Similar to style, colours are semantic rather than definitive colour values. Examples can be found in the [AdapativeCard TextBlock documentation](https://adaptivecards.microsoft.com/?topic=TextBlock). |
| Card Width           | Can be set to “Full” to extend the width of the card in Teams, otherwise "Default" will automatically set the width. This is useful if including a table in the output. |
| Heading              | The large text heading that appears at the top of the card.  |
| Icon                 | A "Fluent Icon" that will appear to the left of the header. You can add more by creating additional entries in the `alertIcon` enumeration in the `cus:teamsAlertActivityWorkflow` schema. Supported icon names can be found in the [AdaptiveCard icon catalog](https://adaptivecards.microsoft.com/?topic=icon-catalog). |
| Subheading           | The subheading text that will be displayed in a smaller font below the header. |
| Alert Text           | The body text that will appear in the posted card.           |
| Include Table        | Check this if you want to include a table of information in the alert. The table appears below the alert text. |
| Table Style*         | Only available if “Include Table” is checked. Specifies the colour accent to apply to the background of the table. |
| Table Columns*       | Only available if “Include Table” is checked. Add a row here for each column that you want in the output table. The activity will generate a header row containing the labels you specify in each entry, and a row for each record in the dataset coming from the branch connected to the input of the activity. Each column value in a row is derived from the dataset by matching the column alias that you specify. You must specify an explicit order for the headers, and you can specify a relative width for each. |
| Tag People           | Check this if you want to “mention” or tag operators or operator groups in the alert. Mentions appear, separated by spaces, at the bottom of the alert card. |
| Tag Assignment Type* | Only available if Tag People is checked. Set the mention target to be either Operator or Operator Group. |
| Operator*            | Only available if the “Operator” type is selected. Single Operator to mention in the alert. |
| Operator Group*      | Only available if the “Operator Group” type is selected. All Operators in the group will be mentioned in the alert. |

## Setting the Teams WebHook URL

The activity “WebHook Option” parameter corresponds to an “Option” defined in the `Platform > Options` screen in the Campaign Client. The “value” of this option is obtained by configuring the Teams Chat or Channel where you want to post alerts.

**NOTE**: the activity uses "Options" to store the WebHook URL for security reasons. If the URL was exposed directly in the activity, anyone with access to the workflow would be able to use the URL to post cards to Teams.

To obtain the URL to use:

1. In Teams, locate the Channel or Chat to which you want to post alerts.
2. Click the 3-dots options icon and select “Workflows” from the menu.
3. In “Find templates”, type “webhook” and select either “Send webhook alerts to a chat”, or “Send webhook alerts to a channel”
4. Select the Team and channel/chat
5. Click Save.
6. Click “Copy webhook link” to copy the URL to your clipboard
7. In Adobe Campaign, go to: `Administration > Platform > Options` and create a new record.
8. Give the Option a sensible internal name.
9. Set the “Data type” to “Long text”. This is critical, as the WebHook URL generated is longer than the 255-character limit of a “Text” type.
10. Paste the URL into the value field.
11. Save the record.

You can now use the internal name in the “WebHook Option” parameter.

If you receive authentication errors in your workflow, double check that you’re using the “Long text” type and that you’ve pasted in the entire WebHook URL.

### Adding the WebHook URL to the instance URL Persmissions

Adobe Campaign has a security feature that limits the use of “external URLs” in JavaScript, called [URL Permissions](https://experienceleague.adobe.com/en/docs/control-panel/using/instances-settings/url-permissions). This just means that the unique PowerAutomate environment that sits behind the WebHooks functionality must be added to the URL Permissions list for each of the Adobe Campaign instances that will use the activity. This only needs to be done once for each Azure backend Teams environment.

To add the appropriate entry to the list, follow these steps:

1. Log on to your [Adobe Campaign Control Panel](https://experience.adobe.com/#/controlpanel)
2. Click Instance Settings > Manage
3. Click URL Permissions, and ensure the correct instance is selected in the Instance List in the top right.
4. Click “Add New URL” and paste the first part of the WebHook URL. For example: `https://defaultabcdefg1234567.b4.environment.api.powerplatform.com`.
5. Click “Save” and wait for the job to complete.

# Implementation / deployment steps

**NOTE**: due to the issue of Campaign stripping XML comments as part of package management, it is advised to manually deploy XML objects (schemas, input forms) to the target instance.

## Steps

1. Create new `cus:teamsalertactivity16x16.png` and `cus:teamsalertactivity48x48.png`"Images" objects, and upload the `Images\custeamsalertactivity16x16.png` and `Images\custeamsalertactivity48x48.png` files respectively.
2. Create a new `cus:teamsAlertActivityWorkflow` "Data schemas" object, extending the out-of-the-box `xtk:workflow` schema.
3. Paste in the content from `Data schemas\cusTeamsAlertActivity.xml`. Note that this is an XML schema, so there is no need to run “Update database structure”.
4. Create a new `cus:teamsAlertActivityWorkflow` "Input forms" object, and paste in the content from `Input forms\cusTeamsAlertActivityWorkflow.xml`
5. Locate and open the existing `xtk:workflow` Input Form object.
6. Follow the instructions in `\Input Forms\xtkWorkflow.xml` to insert the palette and form entries.
7. **Be VERY CAREFUL when doing this**! This is an out-of-the-box input form that drives the workflow UI, so you do not want to mess this up!
8. Create a new `cus:teamsAlertActivity.js` "Javascript codes" object, with name `Teams Alert Activity`, and paste in the content from `Javascript codes\cusTeamsAlertActivity.js`.
9. Clear the local cache, log out, log back in.
10. The new activity should be available in the new "Custom" tab in the workflow palette.
