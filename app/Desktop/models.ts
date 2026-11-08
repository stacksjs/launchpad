import AppPreference from '../Models/AppPreference'
import CatalogPackage from '../Models/CatalogPackage'
import ClipboardEntry from '../Models/ClipboardEntry'
import Command from '../Models/Command'
import ExchangeRate from '../Models/ExchangeRate'
import Extension from '../Models/Extension'
import LaunchRecord from '../Models/LaunchRecord'
import LauncherActivity from '../Models/LauncherActivity'
import LauncherUsageDay from '../Models/LauncherUsageDay'
import PantryInstallation from '../Models/PantryInstallation'
import Theme from '../Models/Theme'
import UsageRecordingPeriod from '../Models/UsageRecordingPeriod'

/**
 * Every model the native backend owns. Web subscription models have a separate declared scope in the same app/Models tree.
 *
 * A model missing from here has no table and no generated endpoints, and the interface calling for it fails at the
 * first request. Nothing about the model itself says so, which is why the list is asserted rather than trusted.
 */
export const models = { AppPreference, CatalogPackage, ClipboardEntry, Command, ExchangeRate, Extension, LaunchRecord, LauncherActivity, LauncherUsageDay, PantryInstallation, Theme, UsageRecordingPeriod }
