import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import en from '../locales/en/common.json'
import sv from '../locales/sv/common.json'
import pt from '../locales/pt/common.json'
import es from '../locales/es/common.json'
import da from '../locales/da/common.json'
import fi from '../locales/fi/common.json'
import fr from '../locales/fr/common.json'
import de from '../locales/de/common.json'
import ja from '../locales/ja/common.json'
import no from '../locales/no/common.json'

i18n
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      sv: { translation: sv },
      pt: { translation: pt },
      es: { translation: es },
      da: { translation: da },
      fi: { translation: fi },
      fr: { translation: fr },
      de: { translation: de },
      ja: { translation: ja },
      no: { translation: no }
    },
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false
    },
    returnEmptyString: false,
    returnNull: false,
    saveMissing: false,
  })

export default i18n