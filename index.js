import OpenAI from 'openai';
import jsonData from './en.json' assert {type: "json"};
import * as fs from 'fs';
import _ from 'lodash';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({path: `${process.cwd()}/.env`});
const client = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.API_KEY,
});

const listLocale = [
  "af", "ak", "sq", "am", "ar", "hy", "as", "az", "bm", "bn", "eu", "be", "bs", "br",
  "bg", "my", "ca", "ckb", "ce", "zh-CN", "zh-TW", "kw", "hr", "cs", "da", "nl", "dz",
  "eo", "et", "ee", "fo", "fil", "fi", "fr", "ff", "gl", "lg", "ka", "de", "el", "gu",
  "ha", "he", "hi", "hu", "is", "ig", "id", "ia", "ga", "it", "ja", "jv", "kl", "kn",
  "ks", "kk", "km", "ki", "rw", "ko", "ku", "ky", "lo", "lv", "ln", "lt", "lu", "lb",
  "mk", "mg", "ms", "ml", "mt", "gv", "mr", "mn", "mi", "ne", "nd", "se", "no", "nb",
  "nn", "or", "om", "os", "ps", "fa", "pl", "pt-BR", "pt-PT", "pa", "qu", "ro", "rm",
  "rn", "ru", "sg", "sa", "sc", "gd", "sr", "sn", "ii", "sd", "si", "sk", "sl", "so",
  "es", "su", "sw", "sv", "tg", "ta", "tt", "te", "th", "bo", "ti", "to", "tr", "tk",
  "uk", "ur", "ug", "uz", "vi", "cy", "fy", "wo", "xh", "yi", "yo", "zu"
];

let doneLocale = [];

const deleteFolderRecursive = (folderPath) => {
  if (fs.existsSync(folderPath)) {
    const files = fs.readdirSync(folderPath);
    files.forEach((file) => {
      const currentPath = path.join(folderPath, file);
      if (fs.statSync(currentPath).isDirectory()) {
        deleteFolderRecursive(currentPath);
      } else {
        fs.unlinkSync(currentPath);
      }
    });
    fs.rmdirSync(folderPath);
  }
}


const jsonString = JSON.stringify(jsonData);

const cleanCodeBlock = (responseText) => {
  return responseText.replace(/```[a-zA-Z]*\n?|```/g, "").trim();
};

const writeTranslate = async (localeList, retry = 0) => {
  if (retry > 3) {
    console.log(`===================== FAIL TO GENERATE FOR ${localeList.join(',')} \n`);
    return true;
  }
  console.log(`=====================TRY TO GET TRANSLATE FOR ${localeList.join(',')} ================================ \n`);
  try {
    const chatCompletion = await client.chat.completions.create({
      messages: [
        {
          role: 'user',
          content: `Translate to locale ${localeList.join(' ')} and format to JS object with key is locale and value has the format similar to input ${jsonString}`
        }
      ],
      model: process.env.MODEL,
    });
    if (chatCompletion?.choices?.[0]?.message?.content) {
      let message = chatCompletion?.choices?.[0]?.message.content;
      message = cleanCodeBlock(message);
      message = JSON.parse(message);
      for (const [locale, translateContent] of Object.entries(message)) {
        if (translateContent?.translate?.translatedLabel) {
          fs.writeFile(`translate_files/${locale}.json`, JSON.stringify(translateContent), "utf8", (err) => {

          });
        } else {
          console.log(translateContent);
          console.log(`===================== RETRY FOR ${localeList.join(',')} \n`);
          return await writeTranslate(localeList, retry + 1);
        }
      }
      console.log(`===================== OK FOR ${localeList.join(',')} \n`);
      doneLocale = doneLocale.concat(localeList);
      return true;
    } else {
      if (chatCompletion?.error?.message) {
        console.log(`${chatCompletion?.error?.message} \n`);
      }
      console.log(`===================== RETRY FOR ${localeList.join(',')} \n`);
      return await writeTranslate(localeList, retry + 1);
    }
  } catch (e) {
    console.log(e.message);
    console.log(`===================== RETRY FOR ${localeList.join(',')} \n`);
    return await writeTranslate(localeList, retry + 1);
  }

}

async function main() {
  const listLocaleChunk = _.chunk(listLocale, 10);
  const promises = [];
  for (const localeChunk of listLocaleChunk) {
    promises.push(writeTranslate(localeChunk));
  }
  try {
    await deleteFolderRecursive('translate_files');
    fs.mkdirSync('translate_files', { recursive: true });
    await Promise.all(promises);
  } catch (error) {
    console.log(error.message);
  }

  const different = _.difference(listLocale, doneLocale);
  if (different?.length) {
    console.log(`=======FAIL : ${different.join(',')} \n`);
  } else {
    console.log('================== DONE ====================')
  }
}
await main();