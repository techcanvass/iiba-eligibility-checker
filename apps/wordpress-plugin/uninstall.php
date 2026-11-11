<?php
/**
 * Removes plugin data when the plugin is deleted from the Plugins screen.
 *
 * @package BA_Certification_Finder
 */

if ( ! defined( 'WP_UNINSTALL_PLUGIN' ) ) {
	exit;
}
delete_option( 'bacf_settings' );
